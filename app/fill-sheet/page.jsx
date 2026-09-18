import Link from "next/link";
import { loadProfile, loadConfig } from "@/src/lib/store.js";
import { buildFillSheet } from "@/src/lib/fillsheet.js";
import CopyButton from "@/app/components/CopyButton.jsx";

function Field({ label, value }) {
  const empty = !value;
  return (
    <div className="flex items-start gap-2 border-b border-gray-800/60 py-1.5 text-sm">
      <div className="w-44 shrink-0 text-gray-400">{label}</div>
      <div className={`flex-1 whitespace-pre-wrap ${empty ? "italic text-rose-300" : "text-gray-200"}`}>{empty ? "not on CV — fill manually" : value}</div>
      {!empty && <CopyButton text={value} />}
    </div>
  );
}

export default function FillSheetPage() {
  const profile = loadProfile();
  if (!profile) return <div className="panel p-4 text-sm text-gray-300">No profile yet. <Link className="underline" href="/profile">Upload your CV</Link>.</div>;
  const sheet = buildFillSheet(profile, loadConfig());
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Application form fill sheet</h1>
        <p className="text-sm text-gray-400">Every field an applicant tracking system usually asks for, taken from your CV, with a copy button. Work through the form in one tab and this page in another.</p>
      </div>
      <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold text-gray-200">Personal details</h2>{sheet.personal.map(([l, v]) => <Field key={l} label={l} value={v} />)}</section>
      {sheet.work.map((w, i) => (
        <section key={i} className="panel p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-200">Work experience {i + 1} {w.missing.length > 0 && <span className="ml-2 badge bg-rose-900 text-rose-200">missing: {w.missing.join(", ")}</span>}</h2>
          {w.fields.map(([l, v]) => <Field key={l} label={l} value={v} />)}
        </section>
      ))}
      {sheet.education.map((e, i) => (
        <section key={i} className="panel p-4"><h2 className="mb-2 text-sm font-semibold text-gray-200">Education {i + 1}</h2>{e.fields.map(([l, v]) => <Field key={l} label={l} value={v} />)}</section>
      ))}
      <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold text-gray-200">Skills</h2>{sheet.skills.map(([l, v]) => <Field key={l} label={l} value={v} />)}<Field label="All keywords (CSV)" value={sheet.keywordsCsv} /></section>
      <section className="panel p-4"><h2 className="mb-2 text-sm font-semibold text-gray-200">Certifications</h2>{sheet.certifications.length ? sheet.certifications.map((c) => <Field key={c} label="Certification" value={c} />) : <p className="text-sm text-gray-500">None on CV.</p>}</section>
    </div>
  );
}
