import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "./store.js";

export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Lazily created so a key saved from the Settings page takes effect without a restart.
let cached = { key: null, client: null };
export function getClient() {
  const key = process.env.ANTHROPIC_API_KEY || "";
  if (!cached.client || cached.key !== key) cached = { key, client: new Anthropic({ apiKey: key || undefined }) };
  return cached.client;
}

export const client = new Proxy({}, { get: (_, prop) => Reflect.get(getClient(), prop) });
export const MODEL = loadConfig().model || "claude-opus-5";
