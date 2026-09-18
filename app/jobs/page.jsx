import Link from "next/link";
import { getAll, sortByScore } from "@/src/lib/data.js";
import { ScoreBadge, StatusBadge, LocBadge } from "../components/Badges.jsx";
import ImportJobForm from "../components/ImportJobForm.jsx";

export default async function JobsPage({ searchParams }) {
  const sp = await searchParams;
  const min = Number(sp.min ?? 0);
  const q = (sp.q || "").toLowerCase();
  const { rows, config } = getAll();

  let list = rows;
  if (sp.scored) list = list.filter((r) => r.match);
  if (min) list = list.filter((r) => (r.match?.score ?? -1) >= min);
  if (sp.loc === "ok") list = list.filter((r) => r.match?.locationOk !== false);
  if (sp.status) list = list.filter((r) => r.status === sp.status);
  if (sp.source) list = list.filter((r) => r.source === sp.source);
  if (sp.verdict) list = list.filter((r) => r.match?.verdict === sp.verdict);
  if (q) list = list.filter((r) => `${r.title} ${r.company} ${r.location}`.toLowerCase().includes(q));
  list = sortByScore(list);

  return (
    <div className="space-y-4">
      <ImportJobForm />
      <form className="panel flex flex-wrap items-end gap-3 p-4" method="get">
        <label className="text-xs text-gray-400">Search<br /><input className="input" name="q" defaultValue={sp.q || ""} placeholder="title, company, location" /></label>
        <label className="text-xs text-gray-400">Min score<br /><input className="input w-20" type="number" name="min" defaultValue={sp.min || ""} /></label>
        <label className="text-xs text-gray-400">Status<br />
          <select className="input" name="status" defaultValue={sp.status || ""}>
            <option value="">any</option>
            {["new", "saved", "prepared", "applied", "interview", "offer", "rejected", "skipped"].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <label className="text-xs text-gray-400">Verdict<br />
          <select className="input" name="verdict" defaultValue={sp.verdict || ""}>
            <option value="">any</option>
            {["apply", "strong", "stretch", "skip"].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <label className="text-xs text-gray-400">Source<br />
          <select className="input" name="source" defaultValue={sp.source || ""}>
            <option value="">any</option>
            {[...(config.sources || []), "manual"].map((s) => <option key={s}>{s}</option>)}
          </select></label>
        <label className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" name="loc" value="ok" defaultChecked={sp.loc === "ok"} /> location ok</label>
        <label className="flex items-center gap-1 text-xs text-gray-400"><input type="checkbox" name="scored" value="1" defaultChecked={!!sp.scored} /> scored only</label>
        <button className="btn btn-primary" type="submit">Filter</button>
        <Link className="btn" href="/jobs">Reset</Link>
        <span className="ml-auto text-xs text-gray-400">{list.length} jobs</span>
      </form>

      <div className="panel overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead><tr><th>Score</th><th>Role</th><th>Company</th><th>Location</th><th>Source</th><th>Posted</th><th>Status</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-white/5">
                <td><div className="flex flex-col gap-1"><ScoreBadge score={r.match?.score} />{r.match && <LocBadge ok={r.match.locationOk} />}</div></td>
                <td><Link className="text-blue-300 hover:underline" href={`/jobs/${encodeURIComponent(r.id)}`}>{r.title}</Link>{r.match && <div className="text-xs text-gray-500">{r.match.verdict}</div>}</td>
                <td>{r.company}</td>
                <td className="text-gray-300">{r.location}</td>
                <td className="text-gray-400">{r.source}</td>
                <td className="text-gray-400 whitespace-nowrap">{r.postedAt ? new Date(r.postedAt).toLocaleDateString() : ""}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={7} className="text-gray-400">No jobs match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
