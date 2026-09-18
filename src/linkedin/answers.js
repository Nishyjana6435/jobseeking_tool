import path from "node:path";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODEL } from "../lib/client.js";
import { DATA_DIR, readJson, writeJson, loadConfig } from "../lib/store.js";
import { systemPrompt } from "../match.js";
import { log } from "../lib/log.js";

const FILE = path.join(DATA_DIR, "answers.json");
export const loadAnswers = () => readJson(FILE, {});
export const saveAnswers = (a) => writeJson(FILE, a);
export const normalize = (q) => q.toLowerCase().replace(/\*|\(required\)|required/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const AnswerSchema = z.object({
  answer: z.string().describe("The exact text to type, or the exact option label to choose. For numeric fields, digits only (e.g. '7'). For yes/no, 'Yes' or 'No'."),
  optionIndex: z.number().nullable().describe("0-based index into the provided options when options are given, else null"),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().describe("One sentence on the basis for the answer"),
});

// Built-in defaults derived from profile/config. Keys are normalized question fragments matched by inclusion.
function builtins(profile, cfg) {
  const a = cfg.applicationAnswers || {};
  return [
    [/mobile phone|phone number/, profile.phone?.replace(/[^\d+]/g, "")],
    [/email/, profile.email],
    [/first name/, profile.name.split(" ")[0]],
    [/last name/, profile.name.split(" ").slice(1).join(" ")],
    [/city|location|where are you (based|located)/, profile.location],
    [/linkedin profile/, profile.links.find((l) => /linkedin/i.test(l.url))?.url],
    [/website|portfolio|github/, profile.links.find((l) => /github/i.test(l.url))?.url],
    [/notice period|how soon|start date|when can you start|availability/, a.noticePeriod],
    [/salary|compensation|ctc|expected pay|rate/, a.expectedSalary],
    [/sponsorship|visa/, a.requiresSponsorship],
    [/authori[sz]ed to work|legally (allowed|eligible) to work|work permit|right to work/, a.workAuthorization],
    [/relocat/, a.willingToRelocate],
    [/remote|hybrid|on.?site|work from office|commut/, a.workArrangement],
    [/years? of (total |overall |professional )?(work )?experience/, String(profile.yearsExperience)],
  ].filter(([, v]) => v);
}

export async function answerQuestion({ question, options = [], type = "text", job, profile, extra = "" }) {
  const cfg = loadConfig();
  const key = normalize(question) + (options.length ? ` [${options.map(normalize).join("|")}]` : "");
  const store = loadAnswers();
  if (store[key]?.answer) return { ...store[key], source: "saved" };

  // Built-in exact-ish matches only when they fit the field type.
  for (const [re, val] of builtins(profile, cfg)) {
    if (re.test(normalize(question))) {
      if (!options.length) return { answer: String(val), optionIndex: null, confidence: "high", source: "builtin" };
      const idx = options.findIndex((o) => normalize(o) === normalize(String(val)) || normalize(o).includes(normalize(String(val))));
      if (idx >= 0) return { answer: options[idx], optionIndex: idx, confidence: "high", source: "builtin" };
    }
  }

  log(`  asking Claude: "${question.slice(0, 80)}"${options.length ? ` options=${options.length}` : ""}`);
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(AnswerSchema) },
    system: systemPrompt(profile, cfg),
    messages: [{
      role: "user",
      content: `Answer this job application form question on behalf of the candidate, truthfully and favourably, using the profile and these standing answers:
${JSON.stringify(cfg.applicationAnswers || {}, null, 2)}

Job: ${job?.title} @ ${job?.company} (${job?.location})
Question: ${question}
Field type: ${type}
${options.length ? `Options (choose exactly one, return its 0-based index):\n${options.map((o, i) => `${i}. ${o}`).join("\n")}` : "Free text. Numeric fields: digits only. Years of experience with a technology: a realistic whole number from the profile (0 if none). Keep free-text answers under 60 words."}
${extra}`,
    }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Could not answer: ${question}`);
  const r = response.parsed_output;
  if (options.length && (r.optionIndex == null || !options[r.optionIndex])) {
    const idx = options.findIndex((o) => normalize(o) === normalize(r.answer));
    r.optionIndex = idx >= 0 ? idx : 0;
    r.answer = options[r.optionIndex];
  }
  store[key] = { question, options, answer: r.answer, optionIndex: r.optionIndex, confidence: r.confidence, note: r.note, savedAt: new Date().toISOString() };
  saveAnswers(store);
  return { ...store[key], source: "claude" };
}
