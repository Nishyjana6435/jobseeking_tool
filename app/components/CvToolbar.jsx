"use client";
import { useState, useTransition } from "react";
import { generateCvAction } from "@/app/actions.js";

export default function CvToolbar({ id, hasCv, onEdit, editing }) {
  const [instructions, setInstructions] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState(null);
  const gen = () => { setErr(null); start(async () => { try { await generateCvAction(id, instructions); } catch (e) { setErr(e.message); } }); };
  return (
    <div className="no-print panel space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" onClick={gen} disabled={pending}>{pending ? "Tailoring (1-2 min)..." : hasCv ? "Regenerate tailored CV" : "Generate tailored CV"}</button>
        {hasCv && <>
          <a className="btn" href={`/api/cv/${encodeURIComponent(id)}`}>Download Word (.docx)</a>
          <button className="btn" onClick={() => window.print()}>Print / Save as PDF</button>
          <button className="btn" onClick={onEdit}>{editing ? "Preview" : "Edit text"}</button>
        </>}
        <a className="btn" href={`/jobs/${encodeURIComponent(id)}`}>← Back to job</a>
      </div>
      <input className="input w-full" placeholder="Optional steering, e.g. 'emphasise team leadership, keep to one page, drop the freelance role'" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      {err && <p className="text-sm text-rose-300">{err}</p>}
    </div>
  );
}
