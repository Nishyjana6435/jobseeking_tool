import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const IS_VERCEL = Boolean(process.env.VERCEL);

// Load .env.local (written by `vercel env pull`) then .env. Next.js has already loaded these for the
// web app; this matters for the CLI. Existing process.env values are never overridden.
dotenv.config({ path: [path.join(ROOT, ".env.local"), path.join(ROOT, ".env")], quiet: true });

// On Vercel the bundle directory is read-only; /tmp is the only writable location and does not persist.
const WRITABLE_ROOT = IS_VERCEL ? path.join("/tmp", "jobseeking") : ROOT;
export const DATA_DIR = path.join(WRITABLE_ROOT, "data");
export const APPS_DIR = path.join(WRITABLE_ROOT, "applications");
export const ENV_FILE = path.join(ROOT, ".env");

export const ENV_KEYS = ["ANTHROPIC_API_KEY", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "MAIL_FROM"];

/** Persist a set of env vars to .env (local only) and apply them to the running process. */
export function saveEnv(values) {
  const entries = Object.entries(values).filter(([k, v]) => ENV_KEYS.includes(k) && v != null && v !== "");
  if (!entries.length) return;
  if (IS_VERCEL) throw new Error("On Vercel these values live in the project's Environment Variables (Settings > Environment Variables), then redeploy.");
  let text = "";
  try { text = fs.readFileSync(ENV_FILE, "utf8"); } catch {}
  for (const [k, v] of entries) {
    const line = `${k}=${JSON.stringify(v)}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`.replace(/^\n/, "");
    process.env[k] = v;
  }
  fs.writeFileSync(ENV_FILE, text, { mode: 0o600 });
}

export const mask = (s) => (s ? `${s.slice(0, 8)}…${s.slice(-4)}` : "not set");
