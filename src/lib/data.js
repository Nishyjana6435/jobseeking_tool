import fs from "node:fs";
import path from "node:path";
import { loadJobs, loadMatches, loadTracker, loadProfile, loadConfig, loadJob, loadMatch, loadTrack } from "./store.js";
import { contactEmails } from "./mail.js";

export async function getAll() {
  const [jobs, matches, tracker, profile, config] = await Promise.all([loadJobs(), loadMatches(), loadTracker(), loadProfile(), loadConfig()]);
  const rows = Object.values(jobs).map((j) => ({
    ...j,
    match: matches[j.id] || null,
    track: tracker[j.id] || null,
    status: tracker[j.id]?.status || "new",
    emails: contactEmails(j),
  }));
  return { rows, jobs, matches, tracker, profile, config };
}

export async function getJob(id) {
  const [job, match, track] = await Promise.all([loadJob(id), loadMatch(id), loadTrack(id)]);
  if (!job) return null;
  let materials = track?.materials ?? null;
  if (!materials && track?.dir) {
    // Older local data kept materials only on disk.
    try { materials = JSON.parse(fs.readFileSync(path.join(track.dir, "job.json"), "utf8")).materials; } catch {}
  }
  return { ...job, match, track, status: track?.status || "new", materials, emails: contactEmails(job) };
}

export function stats(rows) {
  const by = (fn) => rows.filter(fn).length;
  return {
    found: rows.length,
    scored: by((r) => r.match),
    strong: by((r) => r.match && r.match.score >= 70 && r.match.locationOk),
    prepared: by((r) => r.status === "prepared"),
    applied: by((r) => ["applied", "interview", "offer"].includes(r.status)),
    interview: by((r) => r.status === "interview"),
    offer: by((r) => r.status === "offer"),
    rejected: by((r) => r.status === "rejected"),
  };
}

export function sortByScore(rows) {
  return [...rows].sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1) || (b.prefilterScore ?? 0) - (a.prefilterScore ?? 0));
}
