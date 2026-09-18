export function ScoreBadge({ score }) {
  if (score == null) return <span className="badge bg-gray-800 text-gray-400">unscored</span>;
  const cls = score >= 85 ? "bg-emerald-600 text-white" : score >= 70 ? "bg-green-700 text-white" : score >= 50 ? "bg-amber-700 text-white" : "bg-gray-700 text-gray-200";
  return <span className={`badge ${cls}`}>{score}</span>;
}

const statusCls = {
  new: "bg-gray-800 text-gray-300",
  saved: "bg-sky-900 text-sky-200",
  prepared: "bg-indigo-800 text-indigo-100",
  applied: "bg-blue-700 text-white",
  interview: "bg-violet-700 text-white",
  offer: "bg-emerald-600 text-white",
  rejected: "bg-rose-900 text-rose-200",
  skipped: "bg-gray-700 text-gray-400",
};

export function StatusBadge({ status }) {
  return <span className={`badge ${statusCls[status] || statusCls.new}`}>{status}</span>;
}

export function LocBadge({ ok }) {
  if (ok == null) return null;
  return <span className={`badge ${ok ? "bg-gray-800 text-gray-300" : "bg-rose-900 text-rose-200"}`}>{ok ? "loc ok" : "loc blocked"}</span>;
}
