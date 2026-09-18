import { setLogger } from "./log.js";
import { search } from "../search.js";
import { match, ranked } from "../match.js";
import { applyTo } from "../apply.js";
import { loadConfig, loadTracker } from "./store.js";

// Singleton on globalThis so it survives Next.js dev HMR reloads.
const state = globalThis.__jobRunner ??= { current: null, history: [] };

export function getRunState() {
  return { current: state.current, history: state.history.slice(-10) };
}

export function startTask(task, params = {}) {
  if (state.current && !state.current.finishedAt) throw new Error(`A task is already running: ${state.current.task}`);
  const run = { id: Date.now().toString(36), task, params, startedAt: new Date().toISOString(), finishedAt: null, ok: null, logs: [] };
  state.current = run;
  const log = (...a) => { run.logs.push(a.map(String).join(" ")); if (run.logs.length > 400) run.logs.shift(); };
  setLogger(log);

  (async () => {
    try {
      const cfg = loadConfig();
      if (task === "search") await search();
      else if (task === "match") await match({ limit: params.limit ? Number(params.limit) : undefined });
      else if (task === "prepare") {
        const min = Number(params.min ?? cfg.minScoreToPrepare ?? 70);
        const tracker = loadTracker();
        const ids = params.ids?.length
          ? params.ids
          : ranked(min).filter((r) => r.match.locationOk && !tracker[r.id]).slice(0, Number(params.top ?? 5)).map((r) => r.id);
        if (!ids.length) log(`No unprepared jobs with score >= ${min}.`);
        await applyTo(ids, { open: false });
      } else if (task === "easyapply") {
        const { easyApplyMany } = await import("../linkedin/easyapply.js");
        const done = ["applied", "interview", "offer", "rejected", "skipped"];
        const t = loadTracker();
        const ids = params.ids?.length
          ? params.ids
          : ranked(Number(params.min ?? cfg.minScoreToPrepare ?? 70)).filter((r) => r.match.locationOk && r.source === "linkedin" && !done.includes(t[r.id]?.status)).slice(0, Number(params.top ?? 5)).map((r) => r.id);
        if (!ids.length) log("No eligible LinkedIn jobs to apply to.");
        const results = await easyApplyMany(ids, { submit: !!params.submit });
        log(`Done: ${results.map((r) => r.result).join(", ") || "nothing"}`);
      } else if (task === "linkedin-login") {
        const { loginInteractive } = await import("../linkedin/browser.js");
        await loginInteractive();
      } else if (task === "run") {
        await search();
        await match({});
      } else throw new Error(`Unknown task ${task}`);
      run.ok = true;
    } catch (e) {
      run.ok = false;
      log(`ERROR: ${e.message}`);
    } finally {
      run.finishedAt = new Date().toISOString();
      state.history.push(run);
      setLogger(null);
    }
  })();
  return run;
}
