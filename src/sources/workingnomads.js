import { log } from "../lib/log.js";
import { stripHtml } from "../lib/html.js";

// Working Nomads public feed (latest ~50 jobs across categories, location e.g. "Global", "USA", "Europe").
export async function workingnomads() {
  const res = await fetch("https://www.workingnomads.com/api/exposed_jobs/", { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`workingnomads ${res.status}`);
  const list = await res.json();
  const out = list.map((r) => ({
    id: `workingnomads-${r.url.split("/").filter(Boolean).pop()}`, source: "workingnomads", title: r.title, company: r.company_name,
    location: r.location || "Remote", remote: true, url: r.url,
    tags: [r.category_name, ...(r.tags || "").split(",").map((s) => s.trim())].filter(Boolean), jobType: null, salary: null,
    postedAt: r.pub_date ? new Date(r.pub_date).toISOString() : null, description: stripHtml(r.description || ""),
  }));
  log(`  workingnomads: ${out.length} jobs`);
  return out;
}
