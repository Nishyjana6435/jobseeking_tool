import { log } from "../lib/log.js";
import { stripHtml } from "../lib/html.js";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36", "Accept-Language": "en-US,en;q=0.9" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getText(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(25000) });
  if (res.status === 429) throw new Error("LinkedIn rate-limited (429); try again later");
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

function parseCards(html) {
  const cards = [];
  for (const li of html.split("<li>").slice(1)) {
    const id = li.match(/urn:li:jobPosting:(\d+)/)?.[1];
    if (!id) continue;
    const title = stripHtml(li.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/)?.[1] || "");
    const company = stripHtml(li.match(/base-search-card__subtitle[^>]*>([\s\S]*?)<\/h4>/)?.[1] || "");
    const location = stripHtml(li.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/)?.[1] || "");
    const date = li.match(/datetime="([^"]+)"/)?.[1] || null;
    cards.push({ id, title, company, location, date });
  }
  return cards;
}

async function fetchDetail(id) {
  const html = await getText(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`);
  const desc = html.match(/show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1] || "";
  const criteria = [...html.matchAll(/description__job-criteria-text[^"]*"[^>]*>\s*([^<]+)/g)].map((m) => m[1].trim());
  const applyUrl = html.match(/href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]+)"/)?.[1];
  return { description: desc, seniority: criteria[0] || null, jobType: criteria[1] || null, industry: criteria[3] || null, applyUrl };
}

// LinkedIn public guest search. Location-scoped, e.g. "Sri Lanka". Fetches one detail page per new job.
export async function linkedin(terms, { location = "Sri Lanka", pages = 3, known = new Set() } = {}) {
  const seen = new Map();
  for (const term of terms) {
    for (let p = 0; p < pages; p++) {
      const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}&f_TPR=r2592000&start=${p * 10}`;
      let html;
      try { html = await getText(url); } catch (e) { log(`  linkedin: ${e.message}`); break; }
      const cards = parseCards(html);
      if (!cards.length) break;
      for (const c of cards) if (!seen.has(c.id)) seen.set(c.id, c);
      await sleep(400);
    }
  }
  const out = [];
  let fetched = 0;
  for (const c of seen.values()) {
    const id = `linkedin-${c.id}`;
    const base = {
      id, source: "linkedin", title: c.title, company: c.company, location: c.location,
      remote: /remote/i.test(c.title + c.location), url: `https://www.linkedin.com/jobs/view/${c.id}`,
      tags: [], jobType: null, salary: null, postedAt: c.date ? new Date(c.date).toISOString() : null, description: "",
    };
    if (known.has(id)) continue;
    try {
      const d = await fetchDetail(c.id);
      out.push({ ...base, description: stripHtml(d.description), jobType: d.jobType, tags: [d.seniority, d.industry].filter(Boolean) });
      fetched++;
      await sleep(350);
    } catch (e) {
      out.push(base);
    }
  }
  log(`  linkedin: ${seen.size} cards, ${fetched} details fetched`);
  return out;
}
