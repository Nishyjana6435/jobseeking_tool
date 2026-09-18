import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODEL } from "./lib/client.js";
import { FILES, ROOT, loadConfig, writeJson } from "./lib/store.js";

export const ProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  email: z.string(),
  phone: z.string(),
  location: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  summary: z.string(),
  yearsExperience: z.number(),
  seniority: z.string().describe("e.g. Senior, Lead, Manager"),
  skills: z.object({
    languages: z.array(z.string()),
    frontend: z.array(z.string()),
    backend: z.array(z.string()),
    cloudDevops: z.array(z.string()),
    aiMl: z.array(z.string()),
    cmsAndTools: z.array(z.string()),
    leadership: z.array(z.string()),
  }),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string(),
    start: z.string(),
    end: z.string(),
    technologies: z.array(z.string()),
    highlights: z.array(z.string()),
  })),
  projects: z.array(z.object({
    name: z.string(),
    summary: z.string(),
    technologies: z.array(z.string()),
  })),
  education: z.array(z.object({ degree: z.string(), institution: z.string(), year: z.string() })),
  certifications: z.array(z.string()),
  allKeywords: z.array(z.string()).describe("Flat, deduplicated, lowercase list of every skill/tool/technology keyword on the CV, for matching"),
  idealRoles: z.array(z.string()).describe("Job titles this candidate is a strong fit for, inferred from the CV"),
});

export async function buildProfile(cvPath) {
  const abs = path.resolve(ROOT, cvPath);
  const data = fs.readFileSync(abs).toString("base64");
  const ext = path.extname(abs).toLowerCase();

  const docBlock = ext === ".pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
    : { type: "document", source: { type: "text", media_type: "text/plain", data: fs.readFileSync(abs, "utf8") } };

  console.log(`Reading CV ${abs} with ${MODEL}...`);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: "You extract structured candidate profiles from CVs. Be exhaustive and faithful: copy every skill, technology, employer, date and achievement that appears. Never invent facts that are not in the CV.",
    messages: [{
      role: "user",
      content: [docBlock, { type: "text", text: "Extract this CV into the required structure." }],
    }],
    output_config: { format: zodOutputFormat(ProfileSchema) },
  });

  if (response.stop_reason === "refusal") throw new Error(`Model refused: ${response.stop_details?.explanation ?? ""}`);
  if (!response.parsed_output) throw new Error("Could not parse profile from model output");

  const profile = { ...response.parsed_output, sourceCv: abs, extractedAt: new Date().toISOString() };
  writeJson(FILES.profile, profile);
  return profile;
}

if (process.argv[1] && process.argv[1].endsWith("profile.js")) {
  const cv = process.argv[2] || loadConfig().cvPath || "./cv.pdf";
  const p = await buildProfile(cv);
  console.log(`\n${p.name} - ${p.headline}`);
  console.log(`${p.yearsExperience} yrs, ${p.seniority}. ${p.allKeywords.length} keywords, ${p.experience.length} roles, ${p.projects.length} projects.`);
  console.log(`Ideal roles: ${p.idealRoles.join(", ")}`);
  console.log(`Saved to ${FILES.profile}`);
}
