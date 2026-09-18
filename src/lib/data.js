import fs from "node:fs";
import path from "node:path";
import { loadJobs, loadMatches, loadTracker, loadProfile, loadConfig } from "./store.js";

export function getAll() {
  const jobs = loadJobs();
  const matches = loadMatches();
  const tracker = loadTracker();
  const rows = Object.values(jobs).map((j) => ({
    ...j,
    match: matches[j.id] || null,
    track: tracker[j.id] || null,
    status: tracker[j.id]?.status || "new",
  }));
  return { rows, jobs, matches, tracker, profile: loadProfile(), config: loadConfig() };
}

export function getJob(id) {
  const { jobs, matches, tracker } = getAll();
  const job = jobs[id];
  if (!job) return null;
  const track = tracker[id] || null;
  let materials = null;
  if (track?.dir) {
    try { materials = JSON.parse(fs.readFileSync(path.join(track.dir, "job.json"), "utf8")).materials; } catch {}
  }
  return { ...job, match: matches[id] || null, track, status: track?.status || "new", materials };
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
