import Link from "next/link";
import { getAll } from "@/src/lib/data.js";
import { ScoreBadge } from "../components/Badges.jsx";
import StatusSelect from "../components/StatusSelect.jsx";

const COLS = ["saved", "prepared", "applied", "interview", "offer", "rejected"];

export default async function TrackerPage() {
  const { rows } = await getAll();
  const tracked = rows.filter((r) => r.status !== "new");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Application tracker</h1>
        <span className="text-xs text-gray-400">{tracked.length} tracked · {rows.filter((r) => r.status === "skipped").length} skipped</span>
      </div>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {COLS.map((col) => {
          const items = tracked.filter((r) => r.status === col).sort((a, b) => (b.track?.updatedAt || "").localeCompare(a.track?.updatedAt || ""));
          return (
            <div key={col} className="panel flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-300">{col}<span className="text-gray-500">{items.length}</span></div>
              <div className="flex flex-col gap-2 p-2">
                {items.map((r) => (
                  <div key={r.id} className="rounded border border-gray-800 bg-black/20 p-2 text-sm">
                    <div className="flex items-start justify-between gap-2"><Link href={`/jobs/${encodeURIComponent(r.id)}`} className="text-blue-300 hover:underline leading-tight">{r.title}</Link><ScoreBadge score={r.match?.score} /></div>
                    <div className="text-xs text-gray-400">{r.company}</div>
                    {r.track?.notes && <div className="mt-1 line-clamp-2 text-xs text-gray-500">{r.track.notes}</div>}
                    <div className="mt-2"><StatusSelect id={r.id} status={r.status} /></div>
                  </div>
                ))}
                {!items.length && <div className="p-2 text-xs text-gray-600">empty</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
