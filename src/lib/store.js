import fs from "node:fs";
import path from "node:path";
import { db } from "./db.js";
import { ROOT, DATA_DIR, APPS_DIR, IS_VERCEL } from "./env.js";
import { extractEmails } from "./mail.js";

export { ROOT, DATA_DIR, APPS_DIR, IS_VERCEL };
export { backendName, hasRedis } from "./db.js";

// Plain file helpers for local artefacts (application.md, cv.docx, screenshots). Never called at import time.
export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

// Config: config.json in the repo is the seed; once saved from Settings the stored copy wins.
const fileConfig = () => readJson(path.join(ROOT, "config.json"), {});
export async function loadConfig() {
  return (await db().getDoc("config")) || fileConfig();
}
export async function saveConfig(cfg) {
  await db().setDoc("config", cfg);
}

export const loadProfile = () => db().getDoc("profile");
export const saveProfile = (p) => db().setDoc("profile", p);
export async function requireProfile() {
  const p = await loadProfile();
  if (!p) throw new Error("No profile yet. Upload a CV on the Profile page or run: node src/cli.js profile");
  return p;
}

export const loadAnswers = async () => (await db().getDoc("answers")) || {};
export const saveAnswers = (a) => db().setDoc("answers", a);

// Jobs are stored lean (everything but the description) in "jobs", with descriptions in "jobdesc".
// List pages read only the lean map (~0.3 MB instead of ~3 MB); single-job reads merge both.
// Recruiter contact addresses are extracted at write time so list pages can show them without the description.
export const loadJobs = () => db().getMap("jobs");
export async function loadJob(id) {
  const [lean, description] = await Promise.all([db().getMapField("jobs", id), db().getMapField("jobdesc", id)]);
  if (!lean) return null;
  return { ...lean, description: description ?? lean.description ?? "" };
}
/** Full records (with descriptions) for a set of ids. */
export async function loadJobsFull(ids) {
  const [leans, descs] = await Promise.all([db().getMapFields("jobs", ids), db().getMapFields("jobdesc", ids)]);
  return Object.fromEntries(ids.filter((id) => leans[id]).map((id) => [id, { ...leans[id], description: descs[id] ?? leans[id].description ?? "" }]));
}
export async function patchJobs(partial) {
  const lean = {}, desc = {};
  for (const [id, job] of Object.entries(partial)) {
    const { description = "", ...rest } = job;
    lean[id] = { ...rest, contactEmails: extractEmails(`${description}\n${job.applyEmail || ""}\n${job.contact || ""}`) };
    desc[id] = description;
  }
  await db().patchMap("jobs", lean);
  await db().patchMap("jobdesc", desc);
}
export const saveJobs = patchJobs;

export const loadMatches = () => db().getMap("matches");
export const loadMatch = (id) => db().getMapField("matches", id);
export const saveMatches = (m) => db().patchMap("matches", m);
export const patchMatches = (partial) => db().patchMap("matches", partial);

export const loadTracker = () => db().getMap("tracker");
export const loadTrack = (id) => db().getMapField("tracker", id);
export const saveTracker = (t) => db().patchMap("tracker", t);
export const patchTracker = (partial) => db().patchMap("tracker", partial);

export const loadCv = (jobId) => db().getMapField("cvs", jobId);
export const saveCv = (jobId, cv) => db().patchMap("cvs", { [jobId]: cv });

export const STATUSES = ["saved", "prepared", "applied", "interview", "offer", "rejected", "skipped"];

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}

// The uploaded base CV, kept in the database so the hosted app can attach it to emails. { name, mime, base64, size, uploadedAt }
export const loadCvFile = () => db().getDoc("cvfile");
export const saveCvFile = (f) => db().setDoc("cvfile", f);
