import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/src/lib/data.js";
import JobActions from "@/app/components/JobActions.jsx";
import CopyButton from "@/app/components/CopyButton.jsx";
import { ScoreBadge, StatusBadge, LocBadge } from "@/app/components/Badges.jsx";
import { loadCv } from "@/src/cv.js";

function Section({ title, text, children }) {
  return (
    <section className="panel p-4">
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-200">{title}</h3>{text && <CopyButton text={text} />}</div>
      {children ?? <pre className="whitespace-pre-wrap font-sans text-sm text-gray-300">{text}</pre>}
    </section>
  );
}

export default async function JobPage({ params }) {
  const { id } = await params;
  const job = getJob(decodeURIComponent(id));
  if (!job) notFound();
  const m = job.match;
  const mat = job.materials;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/jobs" className="text-xs text-gray-400 hover:text-gray-200">← Jobs</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-white">{job.title}</h1>
          <ScoreBadge score={m?.score} /><StatusBadge status={job.status} />{m && <LocBadge ok={m.locationOk} />}
        </div>
        <div className="text-sm text-gray-400">{job.company} · {job.location} · {job.jobType || ""} {job.salary ? `· ${job.salary}` : ""} · via {job.source}{job.postedAt ? ` · posted ${new Date(job.postedAt).toLocaleDateString()}` : ""}</div>
      </div>

      <JobActions job={{ id: job.id, url: job.url, status: job.status, match: m, materials: mat, track: job.track, hasCv: !!loadCv(job), isLinkedIn: job.source === "linkedin" || /linkedin\.com\/jobs\/view\//.test(job.url) }} />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {mat && (
            <>
              <Section title="Cover letter" text={mat.coverLetter} />
              <Section title={`Application email — ${mat.emailSubject}`} text={`Subject: ${mat.emailSubject}\n\n${mat.emailBody}`} />
              <Section title="Tailored CV summary" text={mat.tailoredSummary} />
              <Section title="Tailored CV bullets" text={mat.tailoredBullets.map((b) => `• ${b}`).join("\n")}>
                <ul className="list-disc space-y-1 pl-5 text-sm text-gray-300">{mat.tailoredBullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
              </Section>
              <Section title="Screening question drafts">
                <div className="space-y-3">{mat.screeningAnswers.map((q, i) => (
                  <div key={i}><div className="flex items-center justify-between"><div className="text-sm font-medium text-gray-200">{q.question}</div><CopyButton text={q.answer} /></div><p className="mt-1 text-sm text-gray-300">{q.answer}</p></div>
                ))}</div>
              </Section>
              <Section title="LinkedIn note" text={mat.linkedinNote} />
            </>
          )}
          <Section title="Job description"><pre className="max-h-[600px] overflow-auto whitespace-pre-wrap font-sans text-sm text-gray-300">{job.description}</pre></Section>
        </div>

        <aside className="space-y-4">
          {m ? (
            <section className="panel p-4 space-y-3 text-sm">
              <h3 className="font-semibold text-gray-200">Match analysis <span className="text-xs text-gray-500">({m.verdict}, {m.model})</span></h3>
              <p className="text-gray-300">{m.reasoning}</p>
              <div><div className="mb-1 text-xs uppercase text-gray-500">Matched skills</div><div className="flex flex-wrap gap-1">{m.matchedSkills.map((s) => <span key={s} className="badge bg-emerald-950 text-emerald-200">{s}</span>)}</div></div>
              <div><div className="mb-1 text-xs uppercase text-gray-500">Gaps</div><ul className="list-disc pl-4 text-gray-300">{m.gaps.map((g) => <li key={g}>{g}</li>)}{!m.gaps.length && <li>None noted</li>}</ul></div>
              <div><div className="mb-1 text-xs uppercase text-gray-500">Tailoring tips</div><ul className="list-disc pl-4 text-gray-300">{m.tailoringTips.map((g) => <li key={g}>{g}</li>)}</ul></div>
            </section>
          ) : <section className="panel p-4 text-sm text-gray-400">Not scored yet. Prefilter keyword hits: {job.keywordHits?.join(", ") || "none"}.</section>}
          {mat?.keywordsToAdd?.length > 0 && (
            <section className="panel p-4 text-sm"><h3 className="mb-2 font-semibold text-gray-200">Keywords to add to CV</h3><div className="flex flex-wrap gap-1">{mat.keywordsToAdd.map((k) => <span key={k} className="badge bg-gray-800 text-gray-300">{k}</span>)}</div></section>
          )}
          {job.track && (
            <section className="panel p-4 text-xs text-gray-400 space-y-1">
              <h3 className="text-sm font-semibold text-gray-200">History</h3>
              {Object.entries(job.track).filter(([k]) => k.endsWith("At")).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => <div key={k}>{k.replace(/At$/, "")}: {new Date(v).toLocaleString()}</div>)}
              {job.track.dir && <div className="pt-1 break-all">Files: {job.track.dir}</div>}
            </section>
          )}
          <section className="panel p-4 text-xs text-gray-400"><div className="mb-1 text-gray-300">Tags</div>{job.tags?.join(", ") || "none"}</section>
        </aside>
      </div>
    </div>
  );
}
