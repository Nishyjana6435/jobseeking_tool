"use server";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { loadTracker, saveTracker, loadJobs, loadMatches, loadConfig, saveConfig, requireProfile, ROOT, STATUSES } from "@/src/lib/store.js";
import { scoreJobs } from "@/src/match.js";
import { prepareApplication } from "@/src/apply.js";
import { buildProfile } from "@/src/profile.js";
import { startTask } from "@/src/lib/runner.js";

function touch(id, patch) {
  const t = loadTracker();
  const job = loadJobs()[id];
  const m = loadMatches()[id];
  t[id] = { title: job?.title, company: job?.company, url: job?.url, score: m?.score ?? null, ...(t[id] || {}), ...patch, updatedAt: new Date().toISOString() };
  saveTracker(t);
  revalidatePath("/", "layout");
  return t[id];
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("bad status");
  touch(id, { status, [`${status}At`]: new Date().toISOString() });
}

export async function setNotes(id, notes) {
  touch(id, { notes });
}

export async function scoreOne(id) {
  const job = loadJobs()[id];
  if (!job) throw new Error("unknown job");
  await scoreJobs([job], requireProfile(), loadConfig());
  revalidatePath("/", "layout");
}

export async function prepareOne(id) {
  const job = loadJobs()[id];
  if (!job) throw new Error("unknown job");
  const m = loadMatches()[id] || { score: 0, verdict: "unknown", locationOk: true, gaps: [], matchedSkills: [], tailoringTips: [], reasoning: "" };
  await prepareApplication(job, m, requireProfile(), loadConfig());
  revalidatePath("/", "layout");
}

export async function runTask(task, params) {
  startTask(task, params);
}

export async function saveConfigAction(formData) {
  const text = formData.get("config");
  const cfg = JSON.parse(text); // throws on invalid JSON -> surfaced as error
  saveConfig(cfg);
  revalidatePath("/", "layout");
}

export async function uploadCv(formData) {
  const file = formData.get("cv");
  if (!file || typeof file === "string" || !file.size) throw new Error("No file");
  const buf = Buffer.from(await file.arrayBuffer());
  const srcExt = path.extname(file.name).toLowerCase();
  let ext = ".txt";
  let out = buf;
  if (srcExt === ".pdf") ext = ".pdf";
  else if (srcExt === ".docx") {
    const mammoth = (await import("mammoth")).default;
    out = Buffer.from((await mammoth.extractRawText({ buffer: buf })).value, "utf8");
  }
  const target = path.join(ROOT, `cv${ext}`);
  fs.writeFileSync(target, out);
  fs.writeFileSync(path.join(ROOT, `cv-original${srcExt}`), buf);
  const cfg = loadConfig();
  saveConfig({ ...cfg, cvPath: `./cv${ext}` });
  await buildProfile(`./cv${ext}`);
  revalidatePath("/", "layout");
}

export async function importJobAction(formData) {
  const { importJobFromUrl } = await import("@/src/import.js");
  const url = String(formData.get("url") || "").trim();
  if (!/^https?:\/\//.test(url)) throw new Error("Enter a full URL");
  const job = await importJobFromUrl(url);
  revalidatePath("/", "layout");
  const { redirect } = await import("next/navigation");
  redirect(`/jobs/${encodeURIComponent(job.id)}`);
}

export async function generateCvAction(id, instructions) {
  const job = loadJobs()[id];
  if (!job) throw new Error("unknown job");
  const { generateTailoredCv } = await import("@/src/cv.js");
  await generateTailoredCv(job, { instructions: instructions || "" });
  revalidatePath("/", "layout");
}

export async function saveCvAction(id, cv) {
  const job = loadJobs()[id];
  if (!job) throw new Error("unknown job");
  const { saveCv, loadCv } = await import("@/src/cv.js");
  const prev = loadCv(job) || {};
  saveCv(job, { ...prev, ...cv, editedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function saveApiKeyAction(formData) {
  const key = String(formData.get("key") || "").trim();
  if (!/^sk-ant-/.test(key)) throw new Error("That does not look like an Anthropic API key");
  const envPath = path.join(ROOT, ".env");
  let text = "";
  try { text = fs.readFileSync(envPath, "utf8"); } catch {}
  const line = `ANTHROPIC_API_KEY=${key}`;
  text = /^ANTHROPIC_API_KEY=.*$/m.test(text) ? text.replace(/^ANTHROPIC_API_KEY=.*$/m, line) : `${text.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envPath, text, { mode: 0o600 });
  process.env.ANTHROPIC_API_KEY = key;
  revalidatePath("/", "layout");
}

export async function saveAnswersAction(formData) {
  const { saveAnswers } = await import("@/src/linkedin/answers.js");
  saveAnswers(JSON.parse(String(formData.get("answers") || "{}")));
  revalidatePath("/settings");
}
