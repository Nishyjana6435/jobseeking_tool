import { log } from "./lib/log.js";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, modelFor } from "./lib/client.js";
import { truncate } from "./lib/html.js";
import { loadConfig, loadJobs, loadMatches, patchMatches, requireProfile } from "./lib/store.js";

const MatchSchema = z.object({
  results: z.array(z.object({
    jobId: z.string(),
    score: z.number().describe("0-100 overall fit. 85+ = apply now, 70-84 = strong, 50-69 = stretch, <50 = skip"),
    verdict: z.enum(["apply", "strong", "stretch", "skip"]),
    locationOk: z.boolean().describe("false if the job is restricted to a region/timezone the candidate cannot work from"),
    matchedSkills: z.array(z.string()),
    gaps: z.array(z.string()).describe("Requirements the candidate does not clearly meet"),
    reasoning: z.string().describe("2-3 sentences on fit"),
    tailoringTips: z.array(z.string()).describe("What to emphasise from the CV for this specific role"),
  })),
});

function profileSummary(p) {
  return [
    `Name: ${p.name}. Headline: ${p.headline}. Location: ${p.location}. ${p.yearsExperience} years experience, seniority: ${p.seniority}.`,
    `Summary: ${p.summary}`,
    `Skills: ${Object.entries(p.skills).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" | ")}`,
    `Experience: ${p.experience.map((e) => `${e.title} @ ${e.company} (${e.start}-${e.end}): ${e.highlights.join("; ")}`).join("\n")}`,
    `Projects: ${p.projects.map((x) => `${x.name}: ${x.summary} [${x.technologies.join(", ")}]`).join("\n")}`,
    `Ideal roles: ${p.idealRoles.join(", ")}`,
  ].join("\n\n");
}

export function systemPrompt(profile, cfg) {
  return [{
    type: "text",
    text: `You are a senior technical recruiter and career coach scoring job postings against ONE candidate.

CANDIDATE PROFILE
${profileSummary(profile)}

CANDIDATE CONSTRAINTS
Based in: ${cfg.candidateLocation}
Work preference: ${cfg.workPreference}
Location focus: ${cfg.locationFocus || "Prefer jobs located in the candidate's home country; remote jobs open to that country are second choice."}

SCORING RULES
- Score fit on skills, seniority and domain. Weight hands-on stack overlap (Next.js/React/Node/TypeScript, headless CMS, AWS/Vercel, LLM/RAG/MCP work) and leadership scope.
- If the job is hard-restricted to a country/region/timezone the candidate cannot legally or practically work from and offers no relocation/remote option, set locationOk=false and cap score at 40.
- Penalise heavy mismatches (e.g. requires 5+ years of Go/Rust/Java-only, embedded, data-science-only PhD roles).
- Jobs physically located in the candidate's home country/city are fully eligible (locationOk=true) and get a small preference. Remote roles open worldwide or to the candidate's region are also eligible.
- If a posting's description is thin (e.g. an image-only advert with just title, company and location), score on title, seniority and company fit alone, say so in reasoning, and keep the score in the 45-70 range unless the title is a clear match.
- Be calibrated and honest. Most jobs should NOT score above 85.`,
    cache_control: { type: "ephemeral" },
  }];
}

function jobBlock(j) {
  return `### JOB ${j.id}
Title: ${j.title}
Company: ${j.company}
Location/restrictions: ${j.location}${j.remote ? " (remote)" : ""}
Type: ${j.jobType || "n/a"} | Salary: ${j.salary || "n/a"} | Posted: ${j.postedAt || "n/a"}
Tags: ${j.tags.join(", ")}
Description:
${truncate(j.description, 6000)}`;
}

export async function scoreJobs(jobs, profile, cfg, batchSize = 8, concurrency = 3) {
  const MODEL = modelFor(cfg);
  const matches = {}; // only the results from this run; written incrementally
  const batches = [];
  for (let i = 0; i < jobs.length; i += batchSize) batches.push(jobs.slice(i, i + batchSize));
  let done = 0;

  async function runBatch(batch, idx) {
    let response;
    try {
      response = await client.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium", format: zodOutputFormat(MatchSchema) },
        system: systemPrompt(profile, cfg),
        messages: [{ role: "user", content: `Score each of these ${batch.length} jobs. Return exactly one result per job, using the exact jobId given.\n\n${batch.map(jobBlock).join("\n\n")}` }],
      });
    } catch (e) {
      log(`  batch ${idx + 1} failed: ${e.message}`);
      return;
    }
    if (response.stop_reason === "refusal") { log(`  batch ${idx + 1}: model refused; skipping.`); return; }
    if (!response.parsed_output) { log(`  batch ${idx + 1}: unparseable; skipping.`); return; }
    const fresh = {};
    for (const r of response.parsed_output.results) {
      if (!batch.find((j) => j.id === r.jobId)) continue;
      fresh[r.jobId] = matches[r.jobId] = { ...r, scoredAt: new Date().toISOString(), model: MODEL };
    }
    await patchMatches(fresh);
    done += batch.length;
    const u = response.usage;
    log(`  scored ${done}/${jobs.length} (batch ${idx + 1}/${batches.length}, tokens in=${u.input_tokens} cached=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens})`);
  }

  // Warm the prompt cache with the first batch, then fan out.
  if (batches.length) await runBatch(batches[0], 0);
  let next = 1;
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(0, batches.length - 1)) }, async () => {
    while (next < batches.length) { const i = next++; await runBatch(batches[i], i); }
  }));
  return matches;
}

export function isLocationEligible(job, cfg) {
  const loc = `${job.location || ""}`;
  const home = new RegExp(cfg.homeLocationPatterns?.join("|") || "sri lanka", "i");
  const open = new RegExp((cfg.preferredLocationPatterns || ["worldwide", "anywhere"]).join("|"), "i");
  const restricted = new RegExp((cfg.restrictedLocationPatterns || []).join("|") || "$^", "i");
  if (home.test(loc)) return true;
  if (open.test(loc)) return true;
  if (restricted.test(loc)) return false;
  return true; // generic "Remote" or unknown: let the model decide
}

export async function match({ limit, all = false } = {}) {
  const cfg = await loadConfig();
  const profile = await requireProfile();
  const jobs = await loadJobs();
  const matches = await loadMatches();
  const pending = Object.values(jobs)
    .filter((j) => !matches[j.id])
    .filter((j) => all || cfg.scoreOnlyEligibleLocations === false || isLocationEligible(j, cfg))
    .sort((a, b) => b.prefilterScore - a.prefilterScore)
    .slice(0, limit ?? cfg.maxJobsToScore ?? 40);
  if (!pending.length) { log("Nothing new to score."); return matches; }
  log(`${pending.length} jobs to score with ${modelFor(cfg)}`);
  return scoreJobs(pending, profile, cfg);
}

export async function ranked(minScore = 0) {
  const jobs = await loadJobs();
  const matches = await loadMatches();
  return Object.values(matches)
    .filter((m) => m.score >= minScore && jobs[m.jobId])
    .sort((a, b) => b.score - a.score)
    .map((m) => ({ ...jobs[m.jobId], match: m }));
}

if (process.argv[1] && process.argv[1].endsWith("match.js")) {
  const lim = process.argv[2] ? Number(process.argv[2]) : undefined;
  await match({ limit: lim });
}
