"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RunPanel() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(20);
  const [top, setTop] = useState(5);
  const [applyTop, setApplyTop] = useState(3);
  const [applyMin, setApplyMin] = useState(75);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const router = useRouter();
  const running = state?.current && !state.current.finishedAt;

  async function poll() {
    try {
      const r = await fetch("/api/run", { cache: "no-store" });
      const s = await r.json();
      const wasRunning = running;
      setState(s);
      if (wasRunning && s.current?.finishedAt) router.refresh();
    } catch {}
  }

  useEffect(() => {
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function start(task, params = {}) {
    setError(null);
    const r = await fetch("/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ task, params }) });
    const j = await r.json();
    if (!j.ok) setError(j.error);
    poll();
  }

  const cur = state?.current;
  return (
    <div className="panel p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={running} onClick={() => start("search")}>Search job boards</button>
        <span className="flex items-center gap-1">
          <button className="btn" disabled={running} onClick={() => start("match", { limit })}>Score next</button>
          <input type="number" className="input w-20" value={limit} min={1} max={200} onChange={(e) => setLimit(Number(e.target.value))} />
        </span>
        <span className="flex items-center gap-1">
          <button className="btn" disabled={running} onClick={() => start("prepare", { top })}>Prepare top</button>
          <input type="number" className="input w-16" value={top} min={1} max={20} onChange={(e) => setTop(Number(e.target.value))} />
        </span>
        <button className="btn" disabled={running} onClick={() => start("run")}>Search + score all new</button>
        <span className="mx-1 h-6 border-l border-gray-700" />
        <button className="btn" disabled={running} onClick={() => start("linkedin-login")}>LinkedIn login</button>
        <span className="flex items-center gap-1">
          <button className="btn" disabled={running} onClick={() => start("easyapply", { top: applyTop, min: applyMin, submit: autoSubmit })}>{autoSubmit ? "Easy Apply + submit top" : "Easy Apply (review) top"}</button>
          <input type="number" className="input w-14" value={applyTop} min={1} max={10} onChange={(e) => setApplyTop(Number(e.target.value))} />
          <span className="text-xs text-gray-400">min score</span>
          <input type="number" className="input w-16" value={applyMin} min={0} max={100} onChange={(e) => setApplyMin(Number(e.target.value))} />
          <label className="flex items-center gap-1 text-xs text-amber-300"><input type="checkbox" checked={autoSubmit} onChange={(e) => setAutoSubmit(e.target.checked)} /> auto-submit</label>
        </span>
        {running && <span className="text-sm text-blue-300 animate-pulse">Running {cur.task}...</span>}
        {error && <span className="text-sm text-rose-300">{error}</span>}
      </div>
      {cur && (
        <div>
          <div className="mb-1 text-xs text-gray-400">
            {cur.task} started {new Date(cur.startedAt).toLocaleTimeString()}
            {cur.finishedAt && <> · finished {new Date(cur.finishedAt).toLocaleTimeString()} · {cur.ok ? "ok" : "failed"}</>}
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-black/40 p-2 text-xs text-gray-300">{cur.logs.slice(-40).join("\n") || "..."}</pre>
        </div>
      )}
    </div>
  );
}
