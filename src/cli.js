#!/usr/bin/env node
import { buildProfile } from "./profile.js";
import { search } from "./search.js";
import { match, ranked } from "./match.js";
import { applyTo, openUrl } from "./apply.js";
import { loadConfig, loadTracker, loadTrack, patchTracker, loadJob, backendName } from "./lib/store.js";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(`--${name}`);

function printRanked(rows) {
  if (!rows.length) return console.log("No scored jobs yet. Run: node src/cli.js run");
  console.log(`\n${"Score".padEnd(6)}${"Verdict".padEnd(9)}${"Loc".padEnd(5)}${"Title".padEnd(45)}${"Company".padEnd(24)}Id`);
  for (const r of rows) {
    console.log(`${String(r.match.score).padEnd(6)}${r.match.verdict.padEnd(9)}${(r.match.locationOk ? "ok" : "NO").padEnd(5)}${r.title.slice(0, 44).padEnd(45)}${(r.company || "").slice(0, 23).padEnd(24)}${r.id}`);
  }
}

switch (cmd) {
  case "profile": {
    const p = await buildProfile(args[0] || (await loadConfig()).cvPath);
    console.log(`${p.name} - ${p.headline}\n${p.allKeywords.length} keywords. Ideal roles: ${p.idealRoles.join(", ")}`);
    break;
  }
  case "search": await search(); break;
  case "match": await match({ limit: flag("limit") ? Number(flag("limit")) : undefined }); break;
  case "list": {
    const min = Number(flag("min") ?? 0);
    printRanked((await ranked(min)).slice(0, Number(flag("top") ?? 50)));
    break;
  }
  case "show": {
    const j = await loadJob(args[0]);
    if (!j) { console.error("Unknown job id"); process.exit(1); }
    console.log(`${j.title} @ ${j.company}\n${j.url}\n${j.location} | ${j.salary || ""}\n\n${j.description.slice(0, 4000)}`);
    break;
  }
  case "apply": {
    const cfg = await loadConfig();
    let ids = args.filter((a) => !a.startsWith("--") && a !== flag("top") && a !== flag("min"));
    if (has("top") || !ids.length) {
      const min = Number(flag("min") ?? cfg.minScoreToPrepare ?? 70);
      const tracker = await loadTracker();
      ids = (await ranked(min)).filter((r) => r.match.locationOk && !tracker[r.id]).slice(0, Number(flag("top") ?? 5)).map((r) => r.id);
      if (!ids.length) { console.log(`No unprepared jobs with score >= ${min}.`); break; }
    }
    await applyTo(ids, { open: !has("no-open") });
    break;
  }
  case "run": {
    const cfg = await loadConfig();
    await search();
    await match({});
    printRanked((await ranked(cfg.minScoreToPrepare ?? 70)).slice(0, 20));
    if (has("prepare")) {
      const tracker = await loadTracker();
      const ids = (await ranked(cfg.minScoreToPrepare ?? 70)).filter((r) => r.match.locationOk && !tracker[r.id]).slice(0, Number(flag("top") ?? 5)).map((r) => r.id);
      await applyTo(ids, { open: !has("no-open") });
    }
    break;
  }
  case "status": {
    const t = await loadTracker();
    const rows = Object.entries(t).sort((a, b) => b[1].score - a[1].score);
    if (!rows.length) { console.log("Nothing tracked yet."); break; }
    for (const [id, r] of rows) console.log(`${String(r.score).padEnd(5)}${r.status.padEnd(10)}${r.title.slice(0, 40).padEnd(41)}${(r.company || "").slice(0, 20).padEnd(21)}${id}`);
    break;
  }
  case "mark": {
    const [id, status] = args;
    const entry = await loadTrack(id);
    if (!entry) { console.error("Not tracked"); process.exit(1); }
    entry.status = status || "applied";
    entry[`${entry.status}At`] = entry.updatedAt = new Date().toISOString();
    await patchTracker({ [id]: entry });
    console.log(`${id} -> ${entry.status}`);
    break;
  }
  case "open": openUrl((await loadJob(args[0]))?.url || args[0]); break;
  case "import": {
    const { importJobFromUrl } = await import("./import.js");
    const j = await importJobFromUrl(args[0]);
    console.log(`Imported ${j.id}. Next: node src/cli.js apply ${j.id}`);
    break;
  }
  case "cv": {
    const { generateTailoredCv, appDir } = await import("./cv.js");
    const { buildDocx } = await import("./lib/docx.js");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const job = await loadJob(args[0]);
    if (!job) { console.error("Unknown job id"); process.exit(1); }
    const cv = await generateTailoredCv(job, { instructions: flag("notes") || "" });
    const out = path.join(appDir(job), "cv.docx");
    fs.mkdirSync(appDir(job), { recursive: true });
    fs.writeFileSync(out, await buildDocx(cv));
    console.log(`Saved ${out}\n${cv.changeNotes.map((n) => `- ${n}`).join("\n")}`);
    break;
  }
  case "linkedin-login": {
    const { loginInteractive, closeBrowser } = await import("./linkedin/browser.js");
    await loginInteractive();
    await closeBrowser();
    break;
  }
  case "easy-apply": {
    const { easyApplyMany } = await import("./linkedin/easyapply.js");
    const { closeBrowser } = await import("./linkedin/browser.js");
    const cfg = await loadConfig();
    const submit = has("submit");
    let ids = args.filter((a) => !a.startsWith("--") && a !== flag("top") && a !== flag("min"));
    if (has("top") || !ids.length) {
      const min = Number(flag("min") ?? cfg.minScoreToPrepare ?? 70);
      const t = await loadTracker();
      const done = ["applied", "interview", "offer", "rejected", "skipped"];
      ids = (await ranked(min)).filter((r) => r.match.locationOk && r.source === "linkedin" && !done.includes(t[r.id]?.status)).slice(0, Number(flag("top") ?? 5)).map((r) => r.id);
    }
    if (!ids.length) { console.log("No eligible LinkedIn jobs."); break; }
    console.log(`${submit ? "AUTO-SUBMIT" : "REVIEW"} mode for ${ids.length} job(s).${submit ? "" : " Each application stops at the Submit button for you to check."}`);
    const results = await easyApplyMany(ids, { submit });
    console.table(results.map((r) => ({ id: r.id, result: r.result, note: r.error || r.url || "" })));
    if (results.some((r) => r.result === "ready_to_submit")) {
      console.log("Browser left open. Press Submit in LinkedIn, then: node src/cli.js mark <jobId> applied. Ctrl+C closes.");
      await new Promise(() => {});
    }
    await closeBrowser();
    break;
  }
  case "fillsheet": {
    const { buildFillSheet } = await import("./lib/fillsheet.js");
    const { loadProfile } = await import("./lib/store.js");
    const sheet = buildFillSheet(await loadProfile(), await loadConfig());
    const print = (title, fields) => { console.log(`\n## ${title}`); for (const [l, v] of fields) console.log(`${l}: ${v || "(not on CV)"}`); };
    print("Personal", sheet.personal);
    sheet.work.forEach((w, i) => print(`Work ${i + 1}`, w.fields));
    sheet.education.forEach((e, i) => print(`Education ${i + 1}`, e.fields));
    break;
  }
  case "migrate": {
    const { migrate } = await import("./migrate.js");
    await migrate();
    break;
  }
  case "db": {
    const { db } = await import("./lib/db.js");
    console.log(`backend: ${backendName()}; ping: ${await db().ping()}`);
    break;
  }
  default:
    console.log(`job-apply-tool  (storage: ${backendName()})

  node src/cli.js profile [cv.pdf]        Extract structured profile from your CV
  node src/cli.js search                  Fetch jobs from configured boards and prefilter by CV keywords
  node src/cli.js match [--limit N]       Score unscored jobs against your CV with Claude
  node src/cli.js list [--min 70] [--top 20]   Show ranked matches
  node src/cli.js show <jobId>            Print a job description
  node src/cli.js apply <jobId...>        Generate cover letter, tailored CV bullets, screening answers; open apply page
  node src/cli.js apply --top 5 [--min 75] [--no-open]   Same, for the best unprepared matches
  node src/cli.js run [--prepare --top 5] Search + match (+ prepare) in one go
  node src/cli.js status                  Application tracker
  node src/cli.js mark <jobId> <status>   e.g. applied, interview, rejected, offer
  node src/cli.js open <jobId>            Open the apply URL
  node src/cli.js import <url>            Add a job from any careers page URL
  node src/cli.js cv <jobId> [--notes "..."]   Generate a tailored CV (cv.json + cv.docx) for a job
  node src/cli.js fillsheet               Print CV fields shaped for application forms
  node src/cli.js linkedin-login          One-time LinkedIn login in a dedicated Chrome profile
  node src/cli.js easy-apply <jobId...> | --top 5 [--min 75] [--submit]
                                          Fill LinkedIn Easy Apply forms; stops at Submit unless --submit
  node src/cli.js migrate                 Copy local data/ and applications/ into the configured database
  node src/cli.js db                      Show which storage backend is active`);
}
