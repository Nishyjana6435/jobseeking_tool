import "./env.js";
import nodemailer from "nodemailer";

// Addresses that are never a person to apply to.
const JUNK = /^(no-?reply|do-?not-?reply|noreply|privacy|legal|support|help|info@example|abuse|postmaster|unsubscribe|dpo|gdpr|accessibility|security|webmaster|newsletter|press|media|sales|billing|invoice)/i;
// Mailboxes for disability accommodation requests, compliance or data-subject requests are not application inboxes.
const JUNK_ANYWHERE = /(accommodat|compliance|whistleblow|dataprotection|data-protection|dsar|eeo|ethics|report)/i;
const JUNK_DOMAINS = /(example\.(com|org)|sentry\.io|wixpress|w3\.org|schema\.org|googleapis|\.png$|\.jpe?g$|\.gif$|\.svg$|\.webp$)/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Every plausible recruiter/hiring contact address in a block of text, deduplicated, best candidates first. */
export function extractEmails(text) {
  const found = new Set();
  for (const raw of String(text || "").match(EMAIL_RE) || []) {
    const e = raw.toLowerCase().replace(/^[._-]+|[._-]+$/g, "");
    if (JUNK.test(e) || JUNK_ANYWHERE.test(e.split("@")[0]) || JUNK_DOMAINS.test(e)) continue;
    found.add(e);
  }
  const score = (e) => (/(career|job|recruit|hiring|talent|hr|people|apply|resume|cv)/.test(e) ? 0 : 1);
  return [...found].sort((a, b) => score(a) - score(b));
}

/** Contact addresses for a job: stored ones from the source, else parsed from the description. */
export function contactEmails(job) {
  if (!job) return [];
  const stored = Array.isArray(job.contactEmails) ? job.contactEmails : [];
  const parsed = extractEmails(`${job.description || ""}\n${job.applyEmail || ""}\n${job.contact || ""}`);
  return [...new Set([...stored, ...parsed])];
}

export function smtpConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
  return { host: SMTP_HOST || "smtp.gmail.com", port: Number(SMTP_PORT || 465), user: SMTP_USER || "", pass: SMTP_PASS || "", from: MAIL_FROM || SMTP_USER || "" };
}
export const smtpConfigured = () => { const c = smtpConfig(); return Boolean(c.host && c.user && c.pass); };

/**
 * Send one email through the configured SMTP account.
 * attachments: [{ filename, content: Buffer, contentType? }]
 */
export async function sendMail({ to, subject, text, attachments = [], replyTo, fromName }) {
  const c = smtpConfig();
  if (!smtpConfigured()) throw new Error("Email is not configured. Add SMTP_USER and SMTP_PASS (a Gmail App Password works) on the Settings page.");
  const transport = nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } });
  const from = fromName && !/</.test(c.from) ? `"${fromName.replace(/"/g, "")}" <${c.from}>` : c.from;
  const info = await transport.sendMail({ from, to, replyTo: replyTo || undefined, subject, text, attachments });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

export async function verifySmtp() {
  const c = smtpConfig();
  if (!smtpConfigured()) return { ok: false, error: "not configured" };
  try {
    await nodemailer.createTransport({ host: c.host, port: c.port, secure: c.port === 465, auth: { user: c.user, pass: c.pass } }).verify();
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

/** Default text for the one-click application email: the short email, the cover letter, then a signature. */
export function defaultEmailBody(materials, profile) {
  const sig = [profile.name, profile.phone, profile.email, ...(profile.links || []).map((l) => l.url)].filter(Boolean).join("\n");
  return `${(materials.emailBody || "").trim()}\n\n${(materials.coverLetter || "").trim()}\n\n${sig}`.trim();
}
