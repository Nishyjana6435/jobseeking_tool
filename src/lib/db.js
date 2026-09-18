import fs from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import { DATA_DIR, IS_VERCEL } from "./env.js";

/**
 * Storage backend. Two implementations with the same interface:
 *  - Redis (Upstash) when UPSTASH_REDIS_REST_URL/TOKEN are set. Used on Vercel and by the CLI once configured.
 *  - Local JSON files under data/ otherwise (the original behaviour), so the CLI keeps working offline.
 *
 * Documents (profile, config, answers) are single JSON values. Maps (jobs, matches, tracker, cvs) are
 * id -> object; in Redis they are hashes so entries can be read and written individually.
 * Map writes always merge: nothing in the app deletes entries, and merging avoids one process
 * clobbering another's additions.
 */

const CHUNK_BYTES = 400_000; // stay well under Upstash's per-request size limit

export const redisCreds = () => ({ url: process.env.UPSTASH_REDIS_REST_URL || "", token: process.env.UPSTASH_REDIS_REST_TOKEN || "" });
export const hasRedis = () => { const { url, token } = redisCreds(); return Boolean(url && token); };

// Re-created when credentials change (e.g. saved from the Settings page) so no restart is needed.
let cached = { key: "", client: null };
function redis() {
  const { url, token } = redisCreds();
  const key = `${url}|${token}`;
  if (!cached.client || cached.key !== key) cached = { key, client: new Redis({ url, token, automaticDeserialization: true, cache: "no-store", retry: { retries: 3, backoff: (n) => 300 * 2 ** n } }) };
  return cached.client;
}

const redisBackend = {
  name: "redis",
  async getDoc(key) { return (await redis().get(key)) ?? null; },
  async setDoc(key, value) { await redis().set(key, value); },
  async getMap(name) { return (await redis().hgetall(name)) || {}; },
  async getMapField(name, id) { return (await redis().hget(name, id)) ?? null; },
  async getMapFields(name, ids) {
    if (!ids.length) return {};
    const out = {};
    for (let i = 0; i < ids.length; i += 50) {
      const slice = ids.slice(i, i + 50);
      const vals = await redis().hmget(name, ...slice);
      for (const id of slice) if (vals?.[id] != null) out[id] = vals[id];
    }
    return out;
  },
  async patchMap(name, partial) {
    const entries = Object.entries(partial);
    if (!entries.length) return;
    let chunk = {}, size = 0;
    const flush = async () => { if (size) await redis().hset(name, chunk); chunk = {}; size = 0; };
    for (const [id, value] of entries) {
      const len = JSON.stringify(value).length + id.length;
      if (size && size + len > CHUNK_BYTES) await flush();
      chunk[id] = value; size += len;
    }
    await flush();
  },
  async delMapField(name, id) { await redis().hdel(name, id); },
  async ping() { return redis().ping(); },
};

const file = (name) => path.join(DATA_DIR, `${name}.json`);
function readFile(name, fallback) {
  try { return JSON.parse(fs.readFileSync(file(name), "utf8")); } catch { return fallback; }
}
function writeFile(name, value) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(value, null, 2));
}

const fileBackend = {
  name: "file",
  async getDoc(key) { return readFile(key, null); },
  async setDoc(key, value) { writeFile(key, value); },
  async getMap(name) { return readFile(name, {}); },
  async getMapField(name, id) { return readFile(name, {})[id] ?? null; },
  async getMapFields(name, ids) { const m = readFile(name, {}); return Object.fromEntries(ids.filter((id) => m[id] != null).map((id) => [id, m[id]])); },
  async patchMap(name, partial) { writeFile(name, { ...readFile(name, {}), ...partial }); },
  async delMapField(name, id) { const m = readFile(name, {}); delete m[id]; writeFile(name, m); },
  async ping() { return "PONG"; },
};

export function db() {
  if (hasRedis()) return redisBackend;
  if (IS_VERCEL) throw new Error("Database not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in the Vercel project's environment variables.");
  return fileBackend;
}

export const backendName = () => (hasRedis() ? "redis" : IS_VERCEL ? "none" : "file");
