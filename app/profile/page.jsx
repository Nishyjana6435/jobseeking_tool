import { loadProfile, loadConfig } from "@/src/lib/store.js";
import { uploadCv } from "@/app/actions.js";

export default function ProfilePage() {
  const p = loadProfile();
  const cfg = loadConfig();
  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h1 className="text-lg font-semibold text-white">CV profile</h1>
        <p className="mt-1 text-xs text-gray-500">PDF, Word (.docx) or plain text. The tailored CV for each job is built from this profile, so make sure it extracted everything.</p>
        <p className="mt-1 text-sm text-gray-400">Current CV: {cfg.cvPath}{p?.extractedAt ? ` · extracted ${new Date(p.extractedAt).toLocaleString()}` : ""}</p>
        <form action={uploadCv} className="mt-3 flex flex-wrap items-center gap-2">
          <input className="input" type="file" name="cv" accept=".pdf,.docx,.txt,.md" required />
          <button className="btn btn-primary" type="submit">Upload and re-extract (about a minute)</button>
        </form>
      </section>
      {p && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-4 space-y-2 text-sm">
            <h2 className="text-base font-semibold text-white">{p.name}</h2>
            <div className="text-gray-300">{p.headline}</div>
            <div className="text-gray-400">{p.location} · {p.email} · {p.phone}</div>
            <div className="flex flex-wrap gap-2 text-xs">{p.links.map((l) => <a key={l.url} className="text-blue-300 underline" href={l.url.startsWith("http") ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer">{l.label}</a>)}</div>
            <p className="text-gray-300">{p.summary}</p>
            <div className="text-gray-400">{p.yearsExperience} years · {p.seniority}</div>
            <div><div className="mb-1 text-xs uppercase text-gray-500">Ideal roles</div><div className="flex flex-wrap gap-1">{p.idealRoles.map((r) => <span key={r} className="badge bg-blue-950 text-blue-200">{r}</span>)}</div></div>
          </section>
          <section className="panel p-4 space-y-3 text-sm">
            <h2 className="text-sm font-semibold text-gray-200">Skills</h2>
            {Object.entries(p.skills).map(([k, v]) => v.length > 0 && (
              <div key={k}><div className="mb-1 text-xs uppercase text-gray-500">{k}</div><div className="flex flex-wrap gap-1">{v.map((s) => <span key={s} className="badge bg-gray-800 text-gray-300">{s}</span>)}</div></div>
            ))}
          </section>
          <section className="panel p-4 space-y-3 text-sm lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-200">Experience</h2>
            {p.experience.map((e, i) => (
              <div key={i}><div className="font-medium text-gray-200">{e.title} · {e.company} <span className="text-xs text-gray-500">{e.start} – {e.end}</span></div>
                <div className="text-xs text-gray-500">{e.technologies.join(", ")}</div>
                <ul className="mt-1 list-disc pl-5 text-gray-300">{e.highlights.map((h, j) => <li key={j}>{h}</li>)}</ul></div>
            ))}
            <h2 className="pt-2 text-sm font-semibold text-gray-200">Projects</h2>
            {p.projects.map((x, i) => <div key={i}><div className="font-medium text-gray-200">{x.name}</div><p className="text-gray-300">{x.summary}</p><div className="text-xs text-gray-500">{x.technologies.join(", ")}</div></div>)}
          </section>
        </div>
      )}
    </div>
  );
}
