import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..", "..");
export const DATA_DIR = path.join(ROOT, "data");
export const APPS_DIR = path.join(ROOT, "applications");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(APPS_DIR, { recursive: true });

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export const FILES = {
  profile: path.join(DATA_DIR, "profile.json"),
  jobs: path.join(DATA_DIR, "jobs.json"),
  matches: path.join(DATA_DIR, "matches.json"),
  tracker: path.join(DATA_DIR, "tracker.json"),
};

export function loadConfig() {
  return readJson(path.join(ROOT, "config.json"), {});
}

export function loadProfile() {
  return readJson(FILES.profile, null);
}

export function requireProfile() {
  const p = loadProfile();
  if (!p) throw new Error("No profile yet. Upload a CV on the Profile page or run: node src/cli.js profile");
  return p;
}

export function saveConfig(cfg) {
  writeJson(path.join(ROOT, "config.json"), cfg);
}

export const STATUSES = ["saved", "prepared", "applied", "interview", "offer", "rejected", "skipped"];


export const loadJobs = () => readJson(FILES.jobs, {});
export const saveJobs = (jobs) => writeJson(FILES.jobs, jobs);
export const loadMatches = () => readJson(FILES.matches, {});
export const saveMatches = (m) => writeJson(FILES.matches, m);
export const loadTracker = () => readJson(FILES.tracker, {});
export const saveTracker = (t) => writeJson(FILES.tracker, t);

export function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
}
