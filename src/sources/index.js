import { log } from "../lib/log.js";
import { stripHtml } from "../lib/html.js";
import { linkedin } from "./linkedin.js";
import { topjobs } from "./topjobs.js";
import { wwr } from "./wwr.js";
import { workingnomads } from "./workingnomads.js";

const UA = { "User-Agent": "Mozilla/5.0 (job-apply-tool; personal use)" };

async function getJson(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

const norm = (j) => ({
  ...j,
  description: stripHtml(j.description || ""),
  postedAt: j.postedAt ? new Date(j.postedAt).toISOString() : null,
});

export const sources = {
  linkedin: (terms, opts) => linkedin(opts.linkedinTerms || terms, opts),
  topjobs: (terms, opts) => topjobs(terms, opts),
  wwr: () => wwr(),
  workingnomads: () => workingnomads(),

  async remotive(terms) {
    const out = [];
    for (const t of terms) {
      const j = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(t)}&limit=50`);
      for (const r of j.jobs || []) {
        out.push(norm({
          id: `remotive-${r.id}`, source: "remotive", title: r.title, company: r.company_name,
          location: r.candidate_required_location || "Remote", remote: true, url: r.url,
          tags: r.tags || [], jobType: r.job_type, salary: r.salary || null,
          postedAt: r.publication_date, description: r.description,
        }));
      }
    }
    return out;
  },

  async arbeitnow(terms) {
    const out = [];
    for (const t of terms) {
      const j = await getJson(`https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(t)}`);
      for (const r of j.data || []) {
        out.push(norm({
          id: `arbeitnow-${r.slug}`, source: "arbeitnow", title: r.title, company: r.company_name,
          location: r.location || (r.remote ? "Remote" : ""), remote: !!r.remote, url: r.url,
          tags: r.tags || [], jobType: (r.job_types || []).join(", "), salary: null,
          postedAt: r.created_at ? r.created_at * 1000 : null, description: r.description,
        }));
      }
    }
    return out;
  },

  async jobicy(terms) {
    const out = [];
    for (const t of terms) {
      const j = await getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(t)}`);
      for (const r of j.jobs || []) {
        out.push(norm({
          id: `jobicy-${r.id}`, source: "jobicy", title: r.jobTitle, company: r.companyName,
          location: r.jobGeo || "Remote", remote: true, url: r.url,
          tags: [...(r.jobIndustry || []), r.jobLevel].filter(Boolean), jobType: (r.jobType || []).join(", "),
          salary: r.annualSalaryMin ? `${r.salaryCurrency || ""} ${r.annualSalaryMin}-${r.annualSalaryMax}` : null,
          postedAt: r.pubDate, description: r.jobDescription,
        }));
      }
    }
    return out;
  },

  async himalayas() {
    const out = [];
    let cursor = null;
    for (let page = 0; page < 15; page++) {
      const j = await getJson(`https://himalayas.app/jobs/api?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
      for (const r of j.jobs || []) {
        out.push(norm({
          id: `himalayas-${r.guid}`, source: "himalayas", title: r.title, company: r.companyName,
          location: (r.locationRestrictions || []).join(", ") || "Worldwide", remote: true,
          url: r.applicationLink || r.guid, tags: [...(r.categories || []), ...(r.seniority || [])],
          jobType: r.employmentType, salary: r.minSalary ? `${r.currency || ""} ${r.minSalary}-${r.maxSalary} ${r.salaryPeriod || ""}` : null,
          postedAt: r.pubDate ? r.pubDate * 1000 : null, description: r.description,
        }));
      }
      cursor = j.nextCursor;
      if (!cursor) break;
    }
    return out;
  },

  async remoteok() {
    const j = await getJson("https://remoteok.com/api");
    return j.filter((r) => r.id).map((r) => norm({
      id: `remoteok-${r.id}`, source: "remoteok", title: r.position, company: r.company,
      location: r.location || "Remote", remote: true, url: r.apply_url || r.url, tags: [...new Set(r.tags || [])],
      jobType: null, salary: r.salary_min ? `$${r.salary_min}-${r.salary_max}` : null,
      postedAt: r.date, description: r.description,
    }));
  },
};

export async function fetchAll(names, terms, opts = {}) {
  const results = await Promise.allSettled(names.map((n) => sources[n]?.(terms, opts) ?? Promise.reject(new Error(`unknown source ${n}`))));
  const jobs = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      log(`  ${names[i]}: ${r.value.length} jobs`);
      jobs.push(...r.value);
    } else {
      log(`  ${names[i]}: FAILED (${r.reason.message})`);
    }
  });
  return jobs;
}
