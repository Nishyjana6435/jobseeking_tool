import { log } from "./lib/log.js";
import { fetchAll } from "./sources/index.js";
import { loadConfig, loadJobs, saveJobs, requireProfile } from "./lib/store.js";

function keywordHits(job, keywords) {
  const hay = `${job.title} ${job.tags.join(" ")} ${job.description}`.toLowerCase();
  return keywords.filter((k) => k.length > 1 && hay.includes(k.toLowerCase()));
}

export function prefilter(jobs, profile, cfg) {
  const titleRe = new RegExp(cfg.targetTitles.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
  const exclRe = cfg.excludeTitleKeywords?.length
    ? new RegExp(cfg.excludeTitleKeywords.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i")
    : null;
  const cutoff = Date.now() - (cfg.maxAgeDays || 30) * 86400000;
  const prefLoc = (cfg.preferredLocationPatterns || []).map((x) => new RegExp(x, "i"));
  const avoidLoc = (cfg.avoidLocationPatterns || []).map((x) => new RegExp(x, "i"));
  const homeRe = new RegExp(cfg.homeLocationPatterns?.join("|") || "sri lanka|colombo", "i");
  const locBoost = (loc = "") => (homeRe.test(loc) ? 10 : prefLoc.some((r) => r.test(loc)) ? 4 : 0) - (avoidLoc.some((r) => r.test(loc.trim())) ? 4 : 0);

  return jobs
    .filter((j) => j.title && j.url)
    .filter((j) => !exclRe || !exclRe.test(j.title))
    .filter((j) => !j.postedAt || new Date(j.postedAt).getTime() >= cutoff)
    .map((j) => {
      const hits = keywordHits(j, profile.allKeywords);
      const titleMatch = titleRe.test(j.title);
      const locationBoost = locBoost(j.location);
      return { ...j, keywordHits: hits, locationBoost, prefilterScore: hits.length + (titleMatch ? 5 : 0) + locationBoost, titleMatch };
    })
    .filter((j) => j.titleMatch || j.keywordHits.length >= 4 || (j.locationBoost >= 10 && j.keywordHits.length >= 1))
    .sort((a, b) => b.prefilterScore - a.prefilterScore);
}

export async function search() {
  const cfg = loadConfig();
  const profile = requireProfile();
  log(`Fetching from ${cfg.sources.join(", ")} for terms: ${cfg.searchTerms.join(", ")}`);
  const jobs = loadJobs();
  const raw = await fetchAll(cfg.sources, cfg.searchTerms, {
    known: new Set(Object.keys(jobs)),
    location: cfg.country || "Sri Lanka",
    linkedinTerms: cfg.linkedinSearchTerms,
    pages: cfg.linkedinPages || 3,
  });

  const seen = new Set();
  const unique = raw.filter((j) => (seen.has(j.id) ? false : seen.add(j.id)));
  const kept = prefilter(unique, profile, cfg);

  let added = 0;
  for (const j of kept) {
    if (!jobs[j.id]) { jobs[j.id] = { ...j, foundAt: new Date().toISOString() }; added++; }
  }
  saveJobs(jobs);
  log(`\n${raw.length} fetched, ${unique.length} unique, ${kept.length} passed prefilter, ${added} new. Total stored: ${Object.keys(jobs).length}`);
  return kept;
}

if (process.argv[1] && process.argv[1].endsWith("search.js")) await search();
