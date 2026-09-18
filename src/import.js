import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, modelFor } from "./lib/client.js";
import { stripHtml, truncate } from "./lib/html.js";
import { loadConfig, patchJobs } from "./lib/store.js";
import { log } from "./lib/log.js";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36" };

const JobSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  remote: z.boolean(),
  jobType: z.string().nullable(),
  salary: z.string().nullable(),
  description: z.string().describe("The full job description, requirements and responsibilities as plain text, faithfully copied, not summarised"),
  tags: z.array(z.string()),
});

function pageText(html) {
  // Phenom (and many ATS) embed the posting as JSON; grab any large description-like field first.
  const m = html.match(/"description":"((?:[^"\\]|\\.){400,})"/);
  const embedded = m ? JSON.parse(`"${m[1]}"`) : "";
  const body = stripHtml(html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, ""));
  return `${embedded ? `EMBEDDED DESCRIPTION:\n${stripHtml(embedded)}\n\n` : ""}PAGE TEXT:\n${body}`;
}

export async function importJobFromUrl(url) {
  log(`Fetching ${url}`);
  const res = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const html = await res.text();
  const text = truncate(pageText(html), 60000);
  const title = stripHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");

  const MODEL = modelFor(await loadConfig());
  log(`Extracting posting with ${MODEL}...`);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(JobSchema) },
    system: "You extract a single job posting from the text of a careers web page. Ignore navigation, cookie banners, related jobs and footer text. Copy the description faithfully.",
    messages: [{ role: "user", content: `URL: ${url}\nPage title: ${title}\n\n${text}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("Could not extract a job posting from that page");
  const j = response.parsed_output;

  const id = `manual-${Buffer.from(url).toString("base64url").slice(0, 40)}`;
  const job = {
    id, source: "manual", title: j.title, company: j.company, location: j.location, remote: j.remote,
    url, tags: j.tags, jobType: j.jobType, salary: j.salary, postedAt: new Date().toISOString(),
    description: j.description, keywordHits: [], prefilterScore: 99, titleMatch: true, locationBoost: 0,
    foundAt: new Date().toISOString(),
  };
  await patchJobs({ [id]: job });
  log(`Saved ${j.title} @ ${j.company} as ${id}`);
  return job;
}
