import fs from "node:fs";
import path from "node:path";
import { getBrowser, pause, isAuthWall } from "./browser.js";
import { answerQuestion } from "./answers.js";
import { loadJobsFull, loadTrack, patchTracker, requireProfile, loadConfig, ROOT } from "../lib/store.js";
import { appDir } from "../cv.js";
import { log } from "../lib/log.js";

export const isLinkedInJob = (job) => /linkedin\.com\/jobs\/view\//.test(job.url || "") || job.source === "linkedin";

function cvFileFor(job, cfg) {
  const dir = appDir(job);
  for (const f of ["cv.pdf", "cv.docx"]) if (fs.existsSync(path.join(dir, f))) return path.join(dir, f);
  const base = path.resolve(ROOT, cfg.cvPath || "./cv.pdf");
  return fs.existsSync(base) ? base : null;
}

async function labelFor(modal, el) {
  const id = await el.getAttribute("id");
  if (id) {
    const lab = modal.locator(`label[for="${id}"]`);
    if (await lab.count()) return (await lab.first().innerText()).trim();
  }
  const aria = await el.getAttribute("aria-label");
  if (aria) return aria.trim();
  const wrapped = el.locator("xpath=ancestor::label[1]");
  if (await wrapped.count()) return (await wrapped.innerText()).trim();
  const group = el.locator("xpath=ancestor::*[contains(@class,'form-section__grouping') or contains(@class,'fb-dash-form-element') or contains(@class,'form-element')][1]//label | ancestor::*[contains(@class,'form-section__grouping') or contains(@class,'fb-dash-form-element')][1]//span[contains(@class,'fb-dash-form-element__label')]");
  if (await group.count()) return (await group.first().innerText()).trim();
  return (await el.getAttribute("placeholder")) || "Unknown field";
}

async function fillStep(page, modal, ctx) {
  const { job, profile, cvPath, state } = ctx;
  let filled = 0;

  // Resume upload: only when a file input is present and no resume is already selected.
  const fileInputs = modal.locator('input[type="file"]');
  if ((await fileInputs.count()) && !state.uploaded && cvPath) {
    const selected = await modal.locator('.jobs-document-upload-redesign-card__container--selected, [class*="resume"] [class*="selected"]').count();
    if (!selected) {
      await fileInputs.first().setInputFiles(cvPath);
      log(`  uploaded ${path.basename(cvPath)}`);
      await pause(1500, 2500);
    } else {
      log("  a resume is already selected on LinkedIn; keeping it");
    }
    state.uploaded = true;
  }

  // Text-like inputs and textareas that are still empty.
  const inputs = modal.locator('input[type="text"], input[type="tel"], input[type="email"], input[type="number"], input:not([type]), textarea');
  for (let i = 0; i < await inputs.count(); i++) {
    const el = inputs.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const val = (await el.inputValue().catch(() => "")) || "";
    if (val.trim()) continue;
    const question = await labelFor(modal, el);
    const tag = await el.evaluate((n) => n.tagName);
    const type = (await el.getAttribute("type")) || (tag === "TEXTAREA" ? "textarea" : "text");
    const isTypeahead = /combobox/.test((await el.getAttribute("role")) || "") || !!(await el.getAttribute("aria-autocomplete"));
    const a = await answerQuestion({ question, type, job, profile });
    await el.click();
    await el.fill(a.answer);
    if (isTypeahead) {
      await pause(1200, 1800);
      const opt = page.locator('[role="listbox"] [role="option"], .basic-typeahead__triggered-content [role="option"]').first();
      if (await opt.count()) await opt.click().catch(() => {});
    }
    log(`  ${type}: "${question.slice(0, 60)}" -> "${a.answer.slice(0, 60)}" (${a.source})`);
    filled++;
    await pause(400, 900);
  }

  // Selects still on the placeholder option.
  const selects = modal.locator("select");
  for (let i = 0; i < await selects.count(); i++) {
    const el = selects.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const current = await el.inputValue().catch(() => "");
    const options = await el.locator("option").allInnerTexts();
    const values = await el.locator("option").evaluateAll((os) => os.map((o) => o.value));
    const currentLabel = options[values.indexOf(current)] || "";
    if (current && !/select an option|^select$|choose/i.test(currentLabel)) continue;
    const real = options.map((o, idx) => ({ o: o.trim(), idx })).filter(({ o }) => o && !/select an option|^select$|choose/i.test(o));
    if (!real.length) continue;
    const question = await labelFor(modal, el);
    const a = await answerQuestion({ question, options: real.map((r) => r.o), type: "select", job, profile });
    await el.selectOption({ index: real[a.optionIndex ?? 0].idx });
    log(`  select: "${question.slice(0, 60)}" -> "${a.answer}" (${a.source})`);
    filled++;
    await pause(400, 900);
  }

  // Radio groups with nothing checked.
  const fieldsets = modal.locator("fieldset");
  for (let i = 0; i < await fieldsets.count(); i++) {
    const group = fieldsets.nth(i);
    const radios = group.locator('input[type="radio"]');
    if (!(await radios.count())) continue;
    if (await group.locator('input[type="radio"]:checked').count()) continue;
    const legend = group.locator("legend, [class*='label']").first();
    const question = (await legend.innerText().catch(() => "")).trim() || "Choose an option";
    const labels = [];
    for (let r = 0; r < await radios.count(); r++) {
      const id = await radios.nth(r).getAttribute("id");
      const lab = id ? group.locator(`label[for="${id}"]`) : radios.nth(r).locator("xpath=following-sibling::label[1]");
      labels.push(((await lab.first().innerText().catch(() => "")) || (await radios.nth(r).getAttribute("value")) || `Option ${r + 1}`).trim());
    }
    const a = await answerQuestion({ question, options: labels, type: "radio", job, profile });
    const idx = a.optionIndex ?? 0;
    const id = await radios.nth(idx).getAttribute("id");
    const target = id ? group.locator(`label[for="${id}"]`) : null;
    if (target && (await target.count())) await target.first().click(); else await radios.nth(idx).check({ force: true });
    log(`  radio: "${question.slice(0, 60)}" -> "${labels[idx]}" (${a.source})`);
    filled++;
    await pause(400, 900);
  }

  // Don't follow the company by default.
  const follow = modal.locator('input#follow-company-checkbox, input[type="checkbox"][id*="follow"]');
  if ((await follow.count()) && (await follow.first().isChecked().catch(() => false))) {
    await modal.locator('label[for="follow-company-checkbox"], label[for*="follow"]').first().click().catch(() => {});
  }
  return filled;
}

async function findButton(modal, patterns) {
  for (const p of patterns) {
    const b = modal.locator(`button[aria-label*="${p}" i], button:has-text("${p}")`).first();
    if ((await b.count()) && (await b.isVisible().catch(() => false))) return b;
  }
  return null;
}

async function errorsIn(modal) {
  const errs = modal.locator('.artdeco-inline-feedback--error, [role="alert"]');
  const texts = (await errs.allInnerTexts().catch(() => [])).map((t) => t.trim()).filter(Boolean);
  return [...new Set(texts)];
}

/**
 * Drive LinkedIn Easy Apply for one job in the user's own logged-in Chrome profile.
 * submit=false (default): fill every step, stop at the final Submit button and leave the window open for the user to review and press Submit.
 * submit=true: press Submit as well.
 * Returns { result: 'submitted' | 'ready_to_submit' | 'external' | 'already_applied' | 'not_easy_apply' | 'error', ... }
 */
export async function easyApply(job, { submit = false } = {}) {
  const cfg = await loadConfig();
  const profile = await requireProfile();
  const cvPath = cvFileFor(job, cfg);
  const ctx = await getBrowser({ headless: false });
  const page = await ctx.newPage();
  const shot = async (name) => {
    try { const dir = appDir(job); fs.mkdirSync(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, `${name}.png`) }); } catch {}
  };
  const mark = async (status, extra = {}) => {
    const prev = (await loadTrack(job.id)) || {};
    await patchTracker({ [job.id]: { title: job.title, company: job.company, url: job.url, ...prev, status, [`${status}At`]: new Date().toISOString(), updatedAt: new Date().toISOString(), ...extra } });
  };

  try {
    log(`Opening ${job.url}`);
    await page.goto(job.url, { waitUntil: "domcontentloaded" });
    await pause(2500, 4000);
    if (isAuthWall(page.url())) throw new Error("Not logged in to LinkedIn. Run: node src/cli.js linkedin-login");

    const applyBtn = page.locator(".jobs-apply-button, button[aria-label*='Easy Apply' i], button:has-text('Easy Apply')").first();
    if (!(await applyBtn.count())) {
      if (await page.locator("text=/Applied\\s+\\d|You applied|Application submitted/i").count()) { await mark("applied", { via: "linkedin" }); return { result: "already_applied" }; }
      await shot("no-apply-button");
      return { result: "not_easy_apply", reason: "No apply button found; the job may be closed" };
    }
    const btnText = (await applyBtn.innerText().catch(() => "")).trim();
    if (!/easy apply/i.test(btnText)) {
      log(`  This job uses an external site ("${btnText}"). Opening it for you.`);
      await applyBtn.click().catch(() => {});
      await pause(2000, 3000);
      const ext = ctx.pages().at(-1);
      return { result: "external", url: ext?.url() };
    }

    await applyBtn.click();
    const modal = page.locator('div[role="dialog"]').last();
    await modal.waitFor({ state: "visible", timeout: 15000 });
    log("  Easy Apply opened");

    const state = { uploaded: false };
    let lastErrors = [];
    for (let step = 1; step <= 20; step++) {
      await pause(900, 1600);
      await fillStep(page, modal, { job, profile, cfg, cvPath, state });
      await pause(500, 900);

      const submitBtn = await findButton(modal, ["Submit application", "Submit"]);
      if (submitBtn) {
        if (!submit) {
          await shot("ready-to-submit");
          log("  Ready to submit. Review mode: the window stays open for you to check and press Submit.");
          await mark("prepared", { via: "linkedin-easy-apply", readyToSubmit: true });
          return { result: "ready_to_submit" };
        }
        await submitBtn.click();
        await pause(2500, 4000);
        const ok = await page.locator("text=/application was sent|Application sent|application was submitted/i").count();
        await shot("submitted");
        await mark("applied", { via: "linkedin-easy-apply" });
        log(ok ? "  Submitted. LinkedIn confirmed." : "  Submitted (no confirmation text seen; check LinkedIn).");
        const dismiss = page.locator('button[aria-label="Dismiss"], button:has-text("Done")').first();
        if (await dismiss.count()) await dismiss.click().catch(() => {});
        return { result: "submitted", confirmed: !!ok };
      }

      const next = await findButton(modal, ["Review your application", "Review", "Continue to next step", "Next", "Continue"]);
      if (!next) { await shot(`stuck-step-${step}`); throw new Error(`No Next/Review/Submit button on step ${step}`); }
      await next.click();
      await pause(1200, 2000);
      const errs = await errorsIn(modal);
      if (errs.length) {
        log(`  validation: ${errs.join(" | ").slice(0, 200)}`);
        if (JSON.stringify(errs) === JSON.stringify(lastErrors)) { await shot(`validation-step-${step}`); throw new Error(`Could not satisfy required fields: ${errs.join("; ")}`); }
        lastErrors = errs;
      } else {
        lastErrors = [];
      }
    }
    throw new Error("Too many steps; aborting");
  } catch (e) {
    log(`  ERROR: ${e.message}`);
    await shot("error");
    return { result: "error", error: e.message };
  } finally {
    if (submit) await page.close().catch(() => {});
  }
}

export async function easyApplyMany(ids, { submit = false } = {}) {
  const cfg = await loadConfig();
  const cap = cfg.easyApplyMaxPerRun || 10;
  const jobs = await loadJobsFull(ids.slice(0, cap));
  const results = [];
  for (const id of ids.slice(0, cap)) {
    const job = jobs[id];
    if (!job) { log(`Unknown job ${id}`); continue; }
    if (!isLinkedInJob(job)) { log(`${job.title} @ ${job.company} is not a LinkedIn job; skipping`); continue; }
    log(`\n=== ${job.title} @ ${job.company}`);
    const r = await easyApply(job, { submit });
    results.push({ id, ...r });
    log(`  -> ${r.result}${r.error ? `: ${r.error}` : ""}`);
    if (r.result === "ready_to_submit") { log("Stopping so you can review this one. Press Submit in the window, then run again for the next."); break; }
    await pause(8000, 15000);
  }
  return results;
}
