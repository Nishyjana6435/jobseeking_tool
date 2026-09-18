"use client";
import { useState, useTransition } from "react";
import { scoreOne, prepareOne, setNotes, runTask } from "@/app/actions.js";
import StatusSelect from "./StatusSelect.jsx";

export default function JobActions({ job, hosted = false }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const [notes, setNotesText] = useState(job.track?.notes || "");
  const [err, setErr] = useState(null);

  const run = (label, fn) => {
    setErr(null); setBusy(label);
    start(async () => { try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(""); } });
  };

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a className="btn btn-primary" href={job.url} target="_blank" rel="noreferrer">Open apply page</a>
        <button className="btn" disabled={pending} onClick={() => run("score", () => scoreOne(job.id))}>{busy === "score" ? "Scoring..." : job.match ? "Re-score" : "Score with Claude"}</button>
        <button className="btn" disabled={pending} onClick={() => run("prepare", () => prepareOne(job.id))}>{busy === "prepare" ? "Generating (1-2 min)..." : job.materials ? "Regenerate materials" : "Generate cover letter + materials"}</button>
        <a className="btn" href={`/jobs/${encodeURIComponent(job.id)}/cv`}>{job.hasCv ? "Tailored CV" : "Tailor my CV for this job"}</a>
        {job.isLinkedIn && !hosted && (
          <>
            <button className="btn" disabled={pending} onClick={() => run("easyapply", () => runTask("easyapply", { ids: [job.id], submit: false }))}>{busy === "easyapply" ? "Started..." : "Auto-fill Easy Apply (review)"}</button>
            <button className="btn border-amber-600" disabled={pending} onClick={() => { if (confirm("Submit this LinkedIn application automatically without reviewing?")) run("easyapply-submit", () => runTask("easyapply", { ids: [job.id], submit: true })); }}>{busy === "easyapply-submit" ? "Started..." : "Auto-apply and submit"}</button>
          </>
        )}
        <StatusSelect id={job.id} status={job.status} />
      </div>
      {err && <p className="text-sm text-rose-300">{err}</p>}
      {job.isLinkedIn && !hosted && <p className="text-xs text-gray-500">Easy Apply runs in a Chrome window on this machine using your saved LinkedIn login. Progress shows in the dashboard log. Log in once from the dashboard first.</p>}
      <div>
        <label className="mb-1 block text-xs text-gray-400">Notes (recruiter name, salary discussed, follow-up dates)</label>
        <textarea className="input w-full" rows={3} value={notes} onChange={(e) => setNotesText(e.target.value)} onBlur={() => start(() => setNotes(job.id, notes))} />
      </div>
    </div>
  );
}
