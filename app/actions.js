"use server";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import {
  loadTrack, patchTracker, loadJob, loadMatch, loadConfig, saveConfig, requireProfile, loadCv, loadCvFile, saveCvFile,
  saveAnswers, DATA_DIR, IS_VERCEL, STATUSES,
} from "@/src/lib/store.js";
import { saveEnv, ENV_KEYS } from "@/src/lib/env.js";
import { scoreJobs } from "@/src/match.js";
import { prepareApplication } from "@/src/apply.js";
import { buildProfile } from "@/src/profile.js";
import { startTask } from "@/src/lib/runner.js";
import { sendMail, contactEmails, defaultEmailBody } from "@/src/lib/mail.js";

async function touch(id, patch) {
  const [prev, job, m] = await Promise.all([loadTrack(id), loadJob(id), loadMatch(id)]);
  const entry = { title: job?.title, company: job?.company, url: job?.url, score: m?.score ?? null, ...(prev || {}), ...patch, updatedAt: new Date().toISOString() };
  await patchTracker({ [id]: entry });
  revalidatePath("/", "layout");
  return entry;
}

async function mustJob(id) {
  const job = await loadJob(id);
  if (!job) throw new Error("unknown job");
  return job;
}

export async function setStatus(id, status) {
  if (!STATUSES.includes(status)) throw new Error("bad status");
  await touch(id, { status, [`${status}At`]: new Date().toISOString() });
}

export async function setNotes(id, notes) {
  await touch(id, { notes });
}

export async function scoreOne(id) {
  const job = await mustJob(id);
  await scoreJobs([job], await requireProfile(), await loadConfig());
  revalidatePath("/", "layout");
}

const EMPTY_MATCH = { score: 0, verdict: "unknown", locationOk: true, gaps: [], matchedSkills: [], tailoringTips: [], reasoning: "" };

export async function prepareOne(id) {
  const job = await mustJob(id);
  const m = (await loadMatch(id)) || EMPTY_MATCH;
  await prepareApplication(job, m, await requireProfile(), await loadConfig());
  revalidatePath("/", "layout");
}

export async function runTask(task, params) {
  const run = startTask(task, params); // throws on Vercel for browser tasks
  if (IS_VERCEL) await run.done;
}

export async function saveConfigAction(formData) {
  const cfg = JSON.parse(formData.get("config")); // throws on invalid JSON -> surfaced as error
  await saveConfig(cfg);
  revalidatePath("/", "layout");
}

const MAX_STORED_CV = 900_000; // bytes; keep under the database's per-request limit

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
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const target = path.join(DATA_DIR, `cv${ext}`);
  fs.writeFileSync(target, out);
  fs.writeFileSync(path.join(DATA_DIR, `cv-original${srcExt}`), buf);
  // Keep the original in the database so the hosted app can attach it to application emails.
  if (buf.length <= MAX_STORED_CV) {
    const mime = srcExt === ".pdf" ? "application/pdf" : srcExt === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
    await saveCvFile({ name: file.name, mime, size: buf.length, base64: buf.toString("base64"), uploadedAt: new Date().toISOString() });
  }
  if (!IS_VERCEL) await saveConfig({ ...(await loadConfig()), cvPath: `./data/cv${ext}` });
  await buildProfile(target);
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
  const job = await mustJob(id);
  const { generateTailoredCv } = await import("@/src/cv.js");
  await generateTailoredCv(job, { instructions: instructions || "" });
  revalidatePath("/", "layout");
}

export async function saveCvAction(id, cv) {
  const job = await mustJob(id);
  const { saveCv } = await import("@/src/cv.js");
  const prev = (await loadCv(id)) || {};
  await saveCv(job, { ...prev, ...cv, editedAt: new Date().toISOString() });
  revalidatePath("/", "layout");
}

/** Save any of the known env vars (API key, database, SMTP) from the Settings page. Local only; on Vercel these are project env vars. */
export async function saveEnvAction(formData) {
  const values = {};
  for (const k of ENV_KEYS) {
    const v = String(formData.get(k) ?? "").trim();
    if (v) values[k] = v;
  }
  if (values.ANTHROPIC_API_KEY && !/^sk-ant-/.test(values.ANTHROPIC_API_KEY)) throw new Error("That does not look like an Anthropic API key");
  saveEnv(values);
  revalidatePath("/", "layout");
}

// Kept for older forms.
export const saveApiKeyAction = saveEnvAction;

export async function saveAnswersAction(formData) {
  await saveAnswers(JSON.parse(String(formData.get("answers") || "{}")));
  revalidatePath("/settings");
}

/** The CV to attach: the tailored CV for this job as .docx, else the uploaded base CV, else the local CV file. */
async function cvAttachment(job, profile, cfg) {
  const tailored = await loadCv(job.id);
  const safe = (s) => String(s || "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (tailored) {
    const { buildDocx } = await import("@/src/lib/docx.js");
    return { filename: `${safe(tailored.name || profile.name)}_CV_${safe(job.company)}.docx`, content: await buildDocx(tailored), contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  const stored = await loadCvFile();
  if (stored?.base64) {
    const ext = path.extname(stored.name || "") || ".pdf";
    return { filename: `${safe(profile.name)}_CV${ext}`, content: Buffer.from(stored.base64, "base64"), contentType: stored.mime };
  }
  if (cfg.cvPath) {
    const { ROOT } = await import("@/src/lib/env.js");
    const abs = path.resolve(ROOT, cfg.cvPath);
    if (fs.existsSync(abs)) return { filename: `${safe(profile.name)}_CV${path.extname(abs)}`, content: fs.readFileSync(abs) };
  }
  throw new Error("No CV to attach. Upload your CV on the Profile page first.");
}

/**
 * One-click application email: generates the cover letter and materials if needed, attaches the CV,
 * sends to the recruiter address, and marks the job as applied.
 */
export async function sendApplicationEmail(id, { to, subject, body } = {}) {
  const job = await mustJob(id);
  const candidates = contactEmails(job);
  const recipient = String(to || candidates[0] || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) throw new Error("No recruiter email address for this job");
  const [profile, cfg] = await Promise.all([requireProfile(), loadConfig()]);

  let track = await loadTrack(id);
  let materials = track?.materials;
  if (!materials) {
    const m = (await loadMatch(id)) || EMPTY_MATCH;
    await prepareApplication(job, m, profile, cfg);
    track = await loadTrack(id);
    materials = track?.materials;
  }
  if (!materials) throw new Error("Could not generate application materials");

  const finalSubject = (subject || "").trim() || materials.emailSubject || `Application: ${job.title} - ${profile.name}`;
  const finalBody = (body || "").trim() || defaultEmailBody(materials, profile);
  const attachment = await cvAttachment(job, profile, cfg);

  const result = await sendMail({ to: recipient, subject: finalSubject, text: finalBody, attachments: [attachment], replyTo: profile.email, fromName: profile.name });
  await touch(id, {
    status: "applied", appliedAt: new Date().toISOString(), via: "email",
    emailedTo: recipient, emailedAt: new Date().toISOString(), emailSubject: finalSubject, emailMessageId: result.messageId, emailAttachment: attachment.filename,
  });
  return { ok: true, to: recipient, attachment: attachment.filename };
}
