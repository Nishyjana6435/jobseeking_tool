import { log } from "./lib/log.js";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODEL } from "./lib/client.js";
import { truncate } from "./lib/html.js";
import { APPS_DIR, loadConfig, loadJobs, loadMatches, requireProfile, loadTracker, saveTracker, slugify, writeJson } from "./lib/store.js";
import { systemPrompt } from "./match.js";

const MaterialsSchema = z.object({
  coverLetter: z.string().describe("Complete cover letter, 250-350 words, plain text, ready to paste. Specific to this company and role. No placeholders."),
  emailSubject: z.string(),
  emailBody: z.string().describe("Short application email (80-120 words) that references the attached CV"),
  tailoredSummary: z.string().describe("Rewritten 3-4 sentence CV professional summary aimed at this role"),
  tailoredBullets: z.array(z.string()).describe("6-8 CV bullets from real experience, reordered/reworded to hit this job's requirements. Do not invent achievements."),
  keywordsToAdd: z.array(z.string()).describe("Keywords from the job description that appear in the candidate's real experience but are missing or weak on the CV"),
  screeningAnswers: z.array(z.object({ question: z.string(), answer: z.string() })).describe("Likely screening questions for this role (why this company, salary expectations, notice period, remote/timezone, biggest relevant project) with drafted answers"),
  linkedinNote: z.string().describe("Under 300 characters, to send to the hiring manager or recruiter"),
});

export async function prepareApplication(job, matchInfo, profile, cfg) {
  const dir = path.join(APPS_DIR, `${slugify(job.company)}--${slugify(job.title)}`);
  fs.mkdirSync(dir, { recursive: true });
  log(`Preparing materials for ${job.title} @ ${job.company}...`);

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(MaterialsSchema) },
    system: systemPrompt(profile, cfg),
    messages: [{
      role: "user",
      content: `Write application materials for the candidate for this job. Use only facts from the candidate profile. Write in first person as the candidate, in a confident, concrete, non-generic voice. Avoid cliches ("I am excited to apply", "passionate"). Lead with the most relevant achievements.

Match analysis from earlier screening:
${JSON.stringify(matchInfo, null, 2)}

### JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
URL: ${job.url}
Description:
${truncate(job.description, 12000)}`,
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Model refused");
  const m = response.parsed_output;
  if (!m) throw new Error("Unparseable materials");

  const md = `# ${job.title} @ ${job.company}

- Apply: ${job.url}
- Source: ${job.source} | Location: ${job.location} | Salary: ${job.salary || "n/a"}
- Match score: ${matchInfo.score} (${matchInfo.verdict}) | Location OK: ${matchInfo.locationOk}
- Gaps: ${matchInfo.gaps.join("; ") || "none noted"}

## Cover letter

${m.coverLetter}

## Application email

**Subject:** ${m.emailSubject}

${m.emailBody}

## Tailored CV summary

${m.tailoredSummary}

## Tailored CV bullets

${m.tailoredBullets.map((b) => `- ${b}`).join("\n")}

## Keywords to add to CV

${m.keywordsToAdd.map((k) => `- ${k}`).join("\n")}

## Screening question drafts

${m.screeningAnswers.map((q) => `**${q.question}**\n\n${q.answer}`).join("\n\n")}

## LinkedIn note

${m.linkedinNote}
`;
  fs.writeFileSync(path.join(dir, "application.md"), md);
  fs.writeFileSync(path.join(dir, "cover-letter.txt"), m.coverLetter);
  writeJson(path.join(dir, "job.json"), { job, match: matchInfo, materials: m });

  const tracker = loadTracker();
  tracker[job.id] = {
    title: job.title, company: job.company, url: job.url, score: matchInfo.score,
    status: "prepared", dir, preparedAt: new Date().toISOString(),
  };
  saveTracker(tracker);
  return dir;
}

export function openUrl(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  execFile(cmd, [url], () => {});
}

export async function applyTo(jobIds, { open = true } = {}) {
  const cfg = loadConfig();
  const profile = requireProfile();
  const jobs = loadJobs();
  const matches = loadMatches();
  for (const id of jobIds) {
    const job = jobs[id];
    if (!job) { log(`Unknown job id ${id}`); continue; }
    const m = matches[id] || { score: 0, verdict: "unknown", locationOk: true, gaps: [], matchedSkills: [], tailoringTips: [], reasoning: "" };
    const dir = await prepareApplication(job, m, profile, cfg);
    log(`  -> ${path.relative(process.cwd(), dir)}/application.md`);
    if (open) openUrl(job.url);
  }
}
