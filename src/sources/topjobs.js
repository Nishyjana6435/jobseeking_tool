import { log } from "../lib/log.js";
import { stripHtml } from "../lib/html.js";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36" };
// Functional areas: SDQ = IT-Software/DB/QA/Web/Graphics/GIS, HNS = IT-Hardware/Networks/Systems, COM = Corporate Management/Analysts
const AREAS = ["SDQ"];

export async function topjobs(_terms, { areas = AREAS } = {}) {
  const out = [];
  for (const fa of areas) {
    const res = await fetch(`https://topjobs.lk/applicant/vacancybyfunctionalarea.jsp?FA=${fa}&jst=OPEN`, { headers: UA, signal: AbortSignal.timeout(90000) });
    if (!res.ok) throw new Error(`topjobs ${res.status}`);
    const html = new TextDecoder("windows-1252").decode(await res.arrayBuffer());
    for (const rawRow of html.split(/<tr id="tr\d+"/).slice(1)) {
      const row = rawRow.replace(/<!--[\s\S]*?-->/g, "");
      const m = row.match(/createAlert\('\d+','([^']+)','([^']+)','([^']+)'/);
      if (!m) continue;
      const [, ac, jc, ec] = m;
      const title = stripHtml(row.match(/<h2>([\s\S]*?)<\/h2>/)?.[1] || "").replace(/\s+/g, " ").trim();
      const company = stripHtml(row.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] || "").replace(/\s+/g, " ").trim();
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => stripHtml(c[1]).replace(/\s+/g, " ").trim());
      const snippet = cells[3] || "";
      const dates = cells.filter((t) => /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}$/.test(t));
      const secondDate = cells.lastIndexOf(dates[1]);
      const location = (secondDate >= 0 && cells[secondDate + 1]) || cells.filter(Boolean).pop() || "";
      const locLabel = location && !/sri lanka/i.test(location) ? `${location}, Sri Lanka` : "Sri Lanka";
      if (!title) continue;
      out.push({
        id: `topjobs-${jc}`, source: "topjobs", title, company,
        location: locLabel, remote: false,
        url: `https://topjobs.lk/employer/JobAdvertismentServlet?ac=${ac}&jc=${jc}&ec=${ec}`,
        tags: ["IT-Software"], jobType: null, salary: null,
        postedAt: dates[0] ? new Date(dates[0]).toISOString() : null,
        closesAt: dates[1] ? new Date(dates[1]).toISOString() : null,
        description: `${snippet}\n(topjobs.lk advert; full details are usually an image on the posting page)`,
        descriptionThin: true,
      });
    }
  }
  log(`  topjobs: ${out.length} vacancies`);
  return out;
}
