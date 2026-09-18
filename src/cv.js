import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODEL } from "./lib/client.js";
import { truncate } from "./lib/html.js";
import { APPS_DIR, loadJobs, loadMatches, loadTracker, saveTracker, requireProfile, loadConfig, slugify, writeJson, readJson } from "./lib/store.js";
import { systemPrompt } from "./match.js";
import { log } from "./lib/log.js";

export const CvSchema = z.object({
  name: z.string(),
  headline: z.string().describe("One line under the name, aimed at this job title"),
  contact: z.object({
    email: z.string(), phone: z.string(), location: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
  }),
  summary: z.string().describe("3-5 sentence professional summary rewritten for this role. Facts only."),
  coreSkills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })).describe("4-7 skill groups, most relevant to the job first; only skills the candidate actually has"),
  experience: z.array(z.object({
    title: z.string(), company: z.string(), location: z.string(), start: z.string(), end: z.string(),
    bullets: z.array(z.string()).describe("Reordered and reworded from the candidate's real highlights to hit this job's requirements. Keep metrics. Do not invent."),
  })),
  projects: z.array(z.object({ name: z.string(), summary: z.string(), bullets: z.array(z.string()), technologies: z.array(z.string()) })).describe("Only projects relevant to this job; may be empty"),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  keywordsCovered: z.array(z.string()).describe("Job-description keywords this CV now contains verbatim"),
  changeNotes: z.array(z.string()).describe("Short notes on what was changed versus the original CV and why"),
});

export function appDir(job) {
  return path.join(APPS_DIR, `${slugify(job.company)}--${slugify(job.title)}`);
}

export function loadCv(job) {
  return readJson(path.join(appDir(job), "cv.json"), null);
}

export function saveCv(job, cv) {
  const dir = appDir(job);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, "cv.json"), cv);
  const t = loadTracker();
  const m = loadMatches()[job.id];
  t[job.id] = { title: job.title, company: job.company, url: job.url, score: m?.score ?? null, status: "saved", ...(t[job.id] || {}), cvDir: dir, cvUpdatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  saveTracker(t);
  return dir;
}

export async function generateTailoredCv(job, { instructions = "" } = {}) {
  const profile = requireProfile();
  const cfg = loadConfig();
  const m = loadMatches()[job.id];
  log(`Tailoring CV for ${job.title} @ ${job.company}...`);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(CvSchema) },
    system: systemPrompt(profile, cfg),
    messages: [{
      role: "user",
      content: `Produce a complete, tailored CV for this candidate for the job below.

Rules:
- Use ONLY facts in the candidate profile. Never invent employers, dates, titles, tools, metrics or achievements. If the job wants something the candidate lacks, leave it out rather than fabricate.
- Keep every employer and date from the profile; you may shorten or drop bullets for older roles and expand relevant ones.
- Mirror the job description's terminology where the candidate genuinely has the skill (ATS keyword matching).
- Target two pages: roughly 3-6 bullets for the two most recent roles, 1-3 for older ones.
- Order skill groups and bullets by relevance to this job.
- Keep projects in the projects section. Do not fold a project into an employer's bullets unless the profile explicitly ties it to that employer.
- Contact details, education and certifications are filled in from the profile automatically; you may leave them minimal.
${instructions ? `\nCandidate's extra instructions: ${instructions}\n` : ""}
${m ? `Match analysis to guide emphasis:\n${JSON.stringify({ matchedSkills: m.matchedSkills, gaps: m.gaps, tailoringTips: m.tailoringTips }, null, 2)}\n` : ""}
### JOB
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description:
${truncate(job.description, 12000)}`,
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("Model refused");
  if (!response.parsed_output) throw new Error("Could not parse tailored CV");
  const facts = {
    name: profile.name,
    contact: { email: profile.email, phone: profile.phone, location: profile.location, links: profile.links },
    education: profile.education,
    certifications: profile.certifications,
  };
  const cv = { ...response.parsed_output, ...facts, jobId: job.id, jobTitle: job.title, company: job.company, generatedAt: new Date().toISOString(), instructions, model: MODEL };
  saveCv(job, cv);
  return cv;
}

if (process.argv[1] && process.argv[1].endsWith("cv.js")) {
  const job = loadJobs()[process.argv[2]];
  if (!job) { console.error("Unknown job id"); process.exit(1); }
  const cv = await generateTailoredCv(job, { instructions: process.argv[3] || "" });
  console.log(`Saved ${path.join(appDir(job), "cv.json")}\n${cv.changeNotes.map((n) => `- ${n}`).join("\n")}`);
}
