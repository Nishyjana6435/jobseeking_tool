import path from "node:path";
import { chromium } from "playwright";
import { DATA_DIR } from "../lib/store.js";
import { log } from "../lib/log.js";

const PROFILE_DIR = path.join(DATA_DIR, "browser-profile");
const state = globalThis.__liBrowser ??= { ctx: null };

export async function getBrowser({ headless = false } = {}) {
  if (state.ctx && !state.ctx.__closed) return state.ctx;
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: "chrome",
    headless,
    viewport: null,
    args: ["--disable-blink-features=AutomationControlled", "--window-size=1280,900"],
    ignoreDefaultArgs: ["--enable-automation"],
  });
  ctx.on("close", () => { ctx.__closed = true; if (state.ctx === ctx) state.ctx = null; });
  state.ctx = ctx;
  return ctx;
}

export async function closeBrowser() {
  if (state.ctx && !state.ctx.__closed) await state.ctx.close().catch(() => {});
  state.ctx = null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const pause = (min = 800, max = 2200) => sleep(min + Math.random() * (max - min));

export function isAuthWall(url) {
  return /linkedin\.com\/(login|authwall|checkpoint|uas\/login|signup)/.test(url);
}

export async function isLoggedIn(page) {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" }).catch(() => {});
  await pause(1500, 2500);
  if (isAuthWall(page.url())) return false;
  return (await page.locator("nav, .global-nav, #global-nav").count()) > 0;
}

// Opens a headed Chrome for the user to log in once. Waits until the feed is reachable.
export async function loginInteractive({ timeoutMs = 10 * 60 * 1000 } = {}) {
  const ctx = await getBrowser({ headless: false });
  const page = ctx.pages()[0] || (await ctx.newPage());
  if (await isLoggedIn(page)) { log("Already logged in to LinkedIn."); return true; }
  await page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded" });
  log("Log in to LinkedIn in the Chrome window (complete any verification). Waiting...");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(2000);
    if (!isAuthWall(page.url()) && /linkedin\.com\/(feed|in\/|jobs|mynetwork)/.test(page.url())) { log("Logged in. Session saved."); return true; }
  }
  throw new Error("Timed out waiting for LinkedIn login");
}
