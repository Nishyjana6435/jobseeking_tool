import Link from "next/link";
import { getAll, stats, sortByScore } from "@/src/lib/data.js";
import { hasApiKey } from "@/src/lib/client.js";
import RunPanel from "./components/RunPanel.jsx";
import { ScoreBadge, StatusBadge, LocBadge } from "./components/Badges.jsx";

function Tile({ label, value, href }) {
  const inner = (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const { rows, profile } = getAll();
  const s = stats(rows);
  const top = sortByScore(rows.filter((r) => r.match && r.match.locationOk && !["rejected", "skipped"].includes(r.status))).slice(0, 10);
  const pipeline = rows.filter((r) => ["applied", "interview", "offer"].includes(r.status)).sort((a, b) => (b.track?.updatedAt || "").localeCompare(a.track?.updatedAt || ""));

  return (
    <div className="space-y-6">
      {!hasApiKey() && <div className="rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">ANTHROPIC_API_KEY is not set in .env. Scoring and material generation will fail until it is.</div>}
      {!profile && <div className="rounded border border-blue-700 bg-blue-950/40 p-3 text-sm text-blue-200">No CV profile yet. <Link className="underline" href="/profile">Upload your CV</Link> to get started.</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
        <Tile label="Found" value={s.found} href="/jobs" />
        <Tile label="Scored" value={s.scored} href="/jobs?scored=1" />
        <Tile label="Strong (70+)" value={s.strong} href="/jobs?min=70&loc=ok" />
        <Tile label="Prepared" value={s.prepared} href="/jobs?status=prepared" />
        <Tile label="Applied" value={s.applied} href="/tracker" />
        <Tile label="Interview" value={s.interview} href="/tracker" />
        <Tile label="Offer" value={s.offer} href="/tracker" />
        <Tile label="Rejected" value={s.rejected} href="/tracker" />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-300">Actions</h2>
        <RunPanel />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-semibold text-gray-300">Top matches</h2><Link className="text-xs text-blue-300" href="/jobs?min=50&loc=ok">View all</Link></div>
          <table className="w-full">
            <thead><tr><th>Score</th><th>Role</th><th>Status</th></tr></thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td><ScoreBadge score={r.match.score} /></td>
                  <td><Link className="text-blue-300 hover:underline" href={`/jobs/${encodeURIComponent(r.id)}`}>{r.title}</Link><div className="text-xs text-gray-400">{r.company} · {r.location}</div></td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {!top.length && <tr><td colSpan={3} className="text-gray-400">Nothing scored yet. Run Search, then Score.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3"><h2 className="text-sm font-semibold text-gray-300">Active applications</h2><Link className="text-xs text-blue-300" href="/tracker">Tracker</Link></div>
          <table className="w-full">
            <thead><tr><th>Status</th><th>Role</th><th>Updated</th></tr></thead>
            <tbody>
              {pipeline.map((r) => (
                <tr key={r.id} className="hover:bg-white/5">
                  <td><StatusBadge status={r.status} /></td>
                  <td><Link className="text-blue-300 hover:underline" href={`/jobs/${encodeURIComponent(r.id)}`}>{r.title}</Link><div className="text-xs text-gray-400">{r.company}</div></td>
                  <td className="text-xs text-gray-400">{r.track?.updatedAt ? new Date(r.track.updatedAt).toLocaleDateString() : ""}</td>
                </tr>
              ))}
              {!pipeline.length && <tr><td colSpan={3} className="text-gray-400">No applications submitted yet. Mark a job as applied from its page.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
