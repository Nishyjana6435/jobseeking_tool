import { log } from "../lib/log.js";
import { stripHtml } from "../lib/html.js";

const CATS = ["remote-full-stack-programming-jobs", "remote-back-end-programming-jobs", "remote-front-end-programming-jobs", "remote-management-and-finance-jobs"];
const tag = (xml, t) => stripHtml((xml.match(new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`))?.[1] || "").replace(/^<!\[CDATA\[|\]\]>$/g, ""));

// We Work Remotely RSS feeds. <region> tells us if the job is open worldwide.
export async function wwr() {
  const out = [];
  for (const c of CATS) {
    const res = await fetch(`https://weworkremotely.com/categories/${c}.rss`, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) { log(`  wwr ${c}: ${res.status}`); continue; }
    const xml = await res.text();
    for (const item of xml.split("<item>").slice(1)) {
      const full = tag(item, "title");
      const [company, ...rest] = full.split(":");
      const title = rest.join(":").trim() || full;
      const link = tag(item, "link");
      const region = tag(item, "region");
      const country = tag(item, "country").replace(/[^\x00-\x7F]/g, "").trim();
      out.push({
        id: `wwr-${link.split("/").filter(Boolean).pop()}`, source: "wwr", title, company: company.trim(),
        location: region || "Remote", remote: true, url: link,
        tags: [tag(item, "category"), ...tag(item, "skills").split(",").map((s) => s.trim())].filter(Boolean),
        jobType: tag(item, "type") || null, salary: null,
        postedAt: tag(item, "pubDate") ? new Date(tag(item, "pubDate")).toISOString() : null,
        description: `${country ? `Company HQ: ${country}\n` : ""}${stripHtml(tag(item, "description"))}`,
      });
    }
  }
  log(`  wwr: ${out.length} jobs`);
  return out;
}
