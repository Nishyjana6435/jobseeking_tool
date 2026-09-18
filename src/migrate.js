// One-off: copy the local JSON data (data/*.json, applications/*/job.json, cv.json, cv.pdf) into the configured database.
import fs from "node:fs";
import path from "node:path";
import { ROOT, hasRedis, patchJobs } from "./lib/store.js";
import { db } from "./lib/db.js";

const LOCAL_DATA = path.join(ROOT, "data");
const LOCAL_APPS = path.join(ROOT, "applications");
const read = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return fb; } };

export async function migrate({ log = console.log } = {}) {
  if (!hasRedis()) throw new Error("UPSTASH_REDIS_REST_URL/TOKEN are not set; nothing to migrate to.");
  const target = db();
  log(`Target: ${target.name}. Ping: ${await target.ping()}`);

  const jobs = read(path.join(LOCAL_DATA, "jobs.json"), {});
  const matches = read(path.join(LOCAL_DATA, "matches.json"), {});
  const tracker = read(path.join(LOCAL_DATA, "tracker.json"), {});
  const profile = read(path.join(LOCAL_DATA, "profile.json"), null);
  const answers = read(path.join(LOCAL_DATA, "answers.json"), null);

  // Materials and tailored CVs live next to application.md locally; fold them into the tracker / cvs map.
  const cvs = {};
  if (fs.existsSync(LOCAL_APPS)) {
    for (const dir of fs.readdirSync(LOCAL_APPS)) {
      const full = path.join(LOCAL_APPS, dir);
      const jobJson = read(path.join(full, "job.json"), null);
      const cv = read(path.join(full, "cv.json"), null);
      const id = jobJson?.job?.id || cv?.jobId || Object.entries(tracker).find(([, t]) => t.dir === full || t.cvDir === full)?.[0];
      if (!id) continue;
      if (jobJson?.materials) tracker[id] = { ...(tracker[id] || {}), title: jobJson.job?.title, company: jobJson.job?.company, url: jobJson.job?.url, materials: jobJson.materials, dir: full, ...(tracker[id] || {}) };
      if (cv) cvs[id] = cv;
    }
  }

  await patchJobs(jobs); log(`jobs: ${Object.keys(jobs).length} (lean records + descriptions)`);
  await target.patchMap("matches", matches); log(`matches: ${Object.keys(matches).length}`);
  await target.patchMap("tracker", tracker); log(`tracker: ${Object.keys(tracker).length}`);
  await target.patchMap("cvs", cvs); log(`tailored cvs: ${Object.keys(cvs).length}`);
  if (profile) { await target.setDoc("profile", profile); log("profile: saved"); }
  if (answers) { await target.setDoc("answers", answers); log(`answers: ${Object.keys(answers).length}`); }

  const cfg = read(path.join(ROOT, "config.json"), {});
  const cvPath = path.resolve(ROOT, cfg.cvPath || "./cv.pdf");
  if (fs.existsSync(cvPath) && fs.statSync(cvPath).size <= 900_000) {
    const buf = fs.readFileSync(cvPath);
    const ext = path.extname(cvPath).toLowerCase();
    const mime = ext === ".pdf" ? "application/pdf" : ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
    await target.setDoc("cvfile", { name: path.basename(cvPath), mime, size: buf.length, base64: buf.toString("base64"), uploadedAt: new Date().toISOString() });
    log(`base cv: ${path.basename(cvPath)} (${buf.length} bytes)`);
  }
  log("Done.");
}

if (process.argv[1] && process.argv[1].endsWith("migrate.js")) await migrate();
