"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendApplicationEmail } from "@/app/actions.js";

/**
 * One-click application email. If materials already exist the subject/body are prefilled and editable;
 * otherwise a single click generates the cover letter, attaches the CV and sends.
 */
export default function EmailPanel({ jobId, emails, draft, smtpReady, attachment, sent }) {
  const [to, setTo] = useState(emails[0] || "");
  const [subject, setSubject] = useState(draft?.subject || "");
  const [body, setBody] = useState(draft?.body || "");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const router = useRouter();

  if (!emails.length) return null;

  const send = () => {
    setErr(null); setMsg(null);
    start(async () => {
      try {
        const r = await sendApplicationEmail(jobId, { to, subject, body });
        setMsg(`Sent to ${r.to} with ${r.attachment}. Marked as applied.`);
        setOpen(false);
        router.refresh();
      } catch (e) { setErr(e.message); }
    });
  };

  return (
    <section className="panel p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-200">Recruiter email found</h3>
        {emails.map((e) => <span key={e} className="badge bg-violet-950 text-violet-200">{e}</span>)}
        {sent && <span className="text-xs text-emerald-300">Emailed {new Date(sent.emailedAt).toLocaleString()} to {sent.emailedTo}</span>}
      </div>
      {!smtpReady && <p className="text-sm text-amber-300">Email sending is not configured yet. Add your SMTP login on the Settings page.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={pending || !smtpReady} onClick={send}>
          {pending ? (draft ? "Sending..." : "Writing cover letter and sending (1-2 min)...") : sent ? "Send again" : draft ? "Send application email" : "Write cover letter, attach CV and send"}
        </button>
        <button className="btn" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Review before sending"}</button>
        <span className="text-xs text-gray-500">Attaches: {attachment}</span>
      </div>
      {open && (
        <div className="space-y-2">
          <label className="block text-xs text-gray-400">To
            {emails.length > 1
              ? <select className="input mt-1 w-full" value={to} onChange={(e) => setTo(e.target.value)}>{emails.map((e) => <option key={e}>{e}</option>)}</select>
              : <input className="input mt-1 w-full" value={to} onChange={(e) => setTo(e.target.value)} />}
          </label>
          <label className="block text-xs text-gray-400">Subject<input className="input mt-1 w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={draft ? "" : "Generated on send"} /></label>
          <label className="block text-xs text-gray-400">Body<textarea className="input mt-1 w-full font-sans text-sm" rows={draft ? 18 : 4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={draft ? "" : "The short application email, the cover letter and your signature are generated on send. Type here to override."} /></label>
        </div>
      )}
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}
      {err && <p className="text-sm text-rose-300">{err}</p>}
    </section>
  );
}
