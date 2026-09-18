"use client";
import { useState, useTransition } from "react";
import { saveCvAction } from "@/app/actions.js";
import CvToolbar from "./CvToolbar.jsx";

function Sheet({ cv }) {
  return (
    <article className="cv-sheet mx-auto max-w-[210mm] rounded border border-gray-300 p-10 shadow">
      <header className="text-center">
        <h1 className="text-2xl font-bold">{cv.name}</h1>
        <div className="text-sm text-gray-700">{cv.headline}</div>
        <div className="mt-1 text-xs text-gray-600">{[cv.contact.location, cv.contact.phone, cv.contact.email].filter(Boolean).join("  |  ")}</div>
        <div className="text-xs text-gray-600">{cv.contact.links.map((l, i) => <span key={l.url}>{i > 0 && "  |  "}<a className="underline" href={/^https?:/.test(l.url) ? l.url : `https://${l.url}`}>{l.label}</a></span>)}</div>
      </header>
      <Section title="Professional Summary"><p className="text-sm leading-snug">{cv.summary}</p></Section>
      <Section title="Core Skills">{cv.coreSkills.map((g) => <p key={g.group} className="text-sm leading-snug"><b>{g.group}:</b> {g.items.join(", ")}</p>)}</Section>
      <Section title="Professional Experience">
        {cv.experience.map((e, i) => (
          <div key={i} className="mb-3">
            <div className="flex items-baseline justify-between"><div className="text-sm"><b>{e.title}</b> | {e.company}</div><div className="text-xs italic text-gray-600">{e.start} – {e.end}{e.location ? ` | ${e.location}` : ""}</div></div>
            <ul className="ml-4 list-disc text-sm leading-snug">{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
          </div>
        ))}
      </Section>
      {cv.projects.length > 0 && <Section title="Selected Projects">
        {cv.projects.map((p, i) => (
          <div key={i} className="mb-2"><div className="text-sm"><b>{p.name}</b> — {p.summary}</div><ul className="ml-4 list-disc text-sm leading-snug">{p.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>{p.technologies.length > 0 && <div className="text-xs italic text-gray-600">Technologies: {p.technologies.join(", ")}</div>}</div>
        ))}
      </Section>}
      <Section title="Education">{cv.education.map((e, i) => <p key={i} className="text-sm"><b>{e.degree}</b> | {e.institution} | {e.year}</p>)}</Section>
      {cv.certifications.length > 0 && <Section title="Certifications"><ul className="ml-4 list-disc text-sm">{cv.certifications.map((c) => <li key={c}>{c}</li>)}</ul></Section>}
    </article>
  );
}

function Section({ title, children }) {
  return <section className="mt-4"><h2 className="mb-1 border-b border-gray-400 text-xs font-bold uppercase tracking-wide">{title}</h2>{children}</section>;
}

const lines = (arr) => arr.join("\n");
const unlines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function Editor({ id, cv, onDone }) {
  const [d, setD] = useState(cv);
  const [pending, start] = useTransition();
  const set = (k, v) => setD({ ...d, [k]: v });
  const setExp = (i, k, v) => setD({ ...d, experience: d.experience.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  return (
    <div className="no-print space-y-4">
      <div className="panel p-4 space-y-2">
        <label className="block text-xs text-gray-400">Headline<input className="input w-full" value={d.headline} onChange={(e) => set("headline", e.target.value)} /></label>
        <label className="block text-xs text-gray-400">Summary<textarea className="input w-full" rows={4} value={d.summary} onChange={(e) => set("summary", e.target.value)} /></label>
        <label className="block text-xs text-gray-400">Core skills (one group per line: Group: a, b, c)<textarea className="input w-full font-mono text-xs" rows={6} value={lines(d.coreSkills.map((g) => `${g.group}: ${g.items.join(", ")}`))} onChange={(e) => set("coreSkills", unlines(e.target.value).map((l) => { const [group, ...rest] = l.split(":"); return { group: group.trim(), items: rest.join(":").split(",").map((x) => x.trim()).filter(Boolean) }; }))} /></label>
      </div>
      {d.experience.map((e, i) => (
        <div key={i} className="panel p-4 space-y-2">
          <div className="text-sm text-gray-200">{e.company}</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <input className="input" value={e.title} onChange={(ev) => setExp(i, "title", ev.target.value)} />
            <input className="input" value={e.location} onChange={(ev) => setExp(i, "location", ev.target.value)} />
            <input className="input" value={e.start} onChange={(ev) => setExp(i, "start", ev.target.value)} />
            <input className="input" value={e.end} onChange={(ev) => setExp(i, "end", ev.target.value)} />
          </div>
          <label className="block text-xs text-gray-400">Bullets (one per line)<textarea className="input w-full" rows={Math.max(3, e.bullets.length + 1)} value={lines(e.bullets)} onChange={(ev) => setExp(i, "bullets", unlines(ev.target.value))} /></label>
        </div>
      ))}
      <div className="panel p-4 space-y-2">
        <label className="block text-xs text-gray-400">Projects (JSON)<textarea className="input w-full font-mono text-xs" rows={8} defaultValue={JSON.stringify(d.projects, null, 1)} onBlur={(e) => { try { set("projects", JSON.parse(e.target.value)); } catch {} }} /></label>
        <label className="block text-xs text-gray-400">Certifications (one per line)<textarea className="input w-full" rows={2} value={lines(d.certifications)} onChange={(e) => set("certifications", unlines(e.target.value))} /></label>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { await saveCvAction(id, d); onDone(); })}>{pending ? "Saving..." : "Save"}</button>
        <button className="btn" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

export default function CvView({ id, cv, jobTitle, company }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-4">
      <div className="no-print"><h1 className="text-lg font-semibold text-white">Tailored CV — {jobTitle} @ {company}</h1>{cv && <p className="text-xs text-gray-500">Generated {new Date(cv.generatedAt).toLocaleString()}{cv.editedAt ? ` · edited ${new Date(cv.editedAt).toLocaleString()}` : ""} · {cv.model}</p>}</div>
      <CvToolbar id={id} hasCv={!!cv} editing={editing} onEdit={() => setEditing((v) => !v)} />
      {!cv && <div className="no-print panel p-4 text-sm text-gray-300">No tailored CV yet. Click "Generate tailored CV". It rewrites your summary, reorders skills, and reworks bullets for this job using only facts from your profile, then you can edit, download as Word, or print to PDF.</div>}
      {cv && !editing && (
        <>
          <Sheet cv={cv} />
          <div className="no-print grid gap-4 lg:grid-cols-2">
            <section className="panel p-4 text-sm"><h3 className="mb-2 font-semibold text-gray-200">What changed and why</h3><ul className="list-disc pl-5 text-gray-300">{cv.changeNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></section>
            <section className="panel p-4 text-sm"><h3 className="mb-2 font-semibold text-gray-200">Job keywords now covered</h3><div className="flex flex-wrap gap-1">{cv.keywordsCovered.map((k) => <span key={k} className="badge bg-emerald-950 text-emerald-200">{k}</span>)}</div></section>
          </div>
        </>
      )}
      {cv && editing && <Editor id={id} cv={cv} onDone={() => setEditing(false)} />}
    </div>
  );
}
