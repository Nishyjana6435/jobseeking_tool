import "./env.js";
import Anthropic from "@anthropic-ai/sdk";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Lazily created so a key saved from the Settings page takes effect without a restart.
let cached = { key: null, client: null };
export function getClient() {
  const key = process.env.ANTHROPIC_API_KEY || "";
  if (!cached.client || cached.key !== key) cached = { key, client: new Anthropic({ apiKey: key || undefined }) };
  return cached.client;
}

export const client = new Proxy({}, { get: (_, prop) => Reflect.get(getClient(), prop) });

export const DEFAULT_MODEL = "claude-opus-5";
/** Model from the loaded config, falling back to the default. Config is async now, so callers pass it in. */
export const modelFor = (cfg) => cfg?.model || DEFAULT_MODEL;
