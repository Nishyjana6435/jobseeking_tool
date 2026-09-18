import { loadConfig, loadAnswers, backendName, IS_VERCEL } from "@/src/lib/store.js";
import { mask } from "@/src/lib/env.js";
import { db } from "@/src/lib/db.js";
import { smtpConfig, smtpConfigured } from "@/src/lib/mail.js";
import { saveConfigAction, saveEnvAction, saveAnswersAction } from "@/app/actions.js";

function EnvForm({ fields, submit }) {
  if (IS_VERCEL) {
    return (
      <p className="mt-2 text-sm text-amber-200">
        This deployment reads these from the Vercel project's Environment Variables (Project → Settings → Environment Variables). Change them there and redeploy.
      </p>
    );
  }
  return (
    <form action={saveEnvAction} className="mt-3 grid gap-2 md:grid-cols-2">
      {fields.map(([name, label, opts = {}]) => (
        <label key={name} className="text-xs text-gray-400">{label}
          <input className="input mt-1 w-full font-mono" name={name} type={opts.secret ? "password" : "text"} placeholder={opts.placeholder || ""} autoComplete="off" />
        </label>
      ))}
      <div className="md:col-span-2"><button className="btn btn-primary" type="submit">{submit}</button> <span className="ml-2 text-xs text-gray-500">Blank fields are left unchanged. Saved to .env and applied immediately.</span></div>
    </form>
  );
}

export default async function SettingsPage() {
  const [cfg, answers] = await Promise.all([loadConfig(), loadAnswers()]);
  const key = process.env.ANTHROPIC_API_KEY || "";
  const backend = backendName();
  let dbStatus = "not configured";
  if (backend === "redis") { try { dbStatus = `connected (${await db().ping()})`; } catch (e) { dbStatus = `error: ${e.message}`; } }
  else if (backend === "file") dbStatus = "local JSON files under data/ (no database configured)";
  const smtp = smtpConfig();

  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h1 className="text-lg font-semibold text-white">Anthropic API key</h1>
        <p className="mt-1 text-sm text-gray-400">Current: <span className="font-mono text-gray-200">{mask(key)}</span></p>
        <EnvForm submit="Save key" fields={[["ANTHROPIC_API_KEY", "API key", { secret: true, placeholder: "sk-ant-api03-..." }]]} />
      </section>

      <section className="panel p-4">
        <h2 className="text-base font-semibold text-white">Database (Upstash Redis)</h2>
        <p className="mt-1 text-sm text-gray-400">Jobs, scores, tracker, profile, tailored CVs and config are stored here so the hosted dashboard and the CLI on your machine share one dataset.</p>
        <p className="mt-1 text-sm text-gray-400">Status: <span className="text-gray-200">{dbStatus}</span> · URL: <span className="font-mono text-gray-200">{process.env.UPSTASH_REDIS_REST_URL || "not set"}</span> · Token: <span className="font-mono text-gray-200">{mask(process.env.UPSTASH_REDIS_REST_TOKEN)}</span></p>
        <EnvForm submit="Save database" fields={[
          ["UPSTASH_REDIS_REST_URL", "REST URL", { placeholder: "https://....upstash.io" }],
          ["UPSTASH_REDIS_REST_TOKEN", "REST token", { secret: true }],
        ]} />
        {!IS_VERCEL && backend === "redis" && <p className="mt-2 text-xs text-gray-500">To copy existing local data into the database once: <code>node src/cli.js migrate</code></p>}
      </section>

      <section className="panel p-4">
        <h2 className="text-base font-semibold text-white">Email (for one-click applications)</h2>
        <p className="mt-1 text-sm text-gray-400">Application emails are sent from your own mailbox over SMTP so replies land in your inbox. For Gmail: turn on 2-step verification, create an App Password, and use it as the password with your Gmail address as the user. Host smtp.gmail.com, port 465.</p>
        <p className="mt-1 text-sm text-gray-400">Status: <span className={smtpConfigured() ? "text-emerald-300" : "text-amber-300"}>{smtpConfigured() ? "configured" : "not configured"}</span> · {smtp.host}:{smtp.port} · user <span className="font-mono text-gray-200">{smtp.user || "not set"}</span> · from <span className="font-mono text-gray-200">{smtp.from || "not set"}</span></p>
        <EnvForm submit="Save email settings" fields={[
          ["SMTP_HOST", "SMTP host", { placeholder: "smtp.gmail.com" }],
          ["SMTP_PORT", "SMTP port", { placeholder: "465" }],
          ["SMTP_USER", "SMTP user (your email address)", { placeholder: "you@gmail.com" }],
          ["SMTP_PASS", "SMTP password / app password", { secret: true }],
          ["MAIL_FROM", "From address (optional, defaults to the user)", { placeholder: "you@gmail.com" }],
        ]} />
      </section>

      <section className="panel p-4">
        <h2 className="text-base font-semibold text-white">Search and matching config</h2>
        <p className="mt-1 text-sm text-gray-400">Target titles, search terms, sources, location rules, model, and the standing answers used by LinkedIn Easy Apply. Stored in the database; config.json in the repo is only the initial seed.</p>
        <form action={saveConfigAction} className="mt-3 space-y-2">
          <textarea className="input w-full font-mono text-xs" name="config" rows={14} defaultValue={JSON.stringify(cfg, null, 2)} />
          <button className="btn btn-primary" type="submit">Save config</button>
        </form>
      </section>

      <section className="panel p-4">
        <h2 className="text-base font-semibold text-white">Learned form answers</h2>
        <p className="mt-1 text-sm text-gray-400">Every question Claude answered during Easy Apply is saved here and reused. Fix any answer and save; delete an entry to make it ask again.</p>
        <form action={saveAnswersAction} className="mt-3 space-y-2">
          <textarea className="input w-full font-mono text-xs" name="answers" rows={Math.min(30, Math.max(6, Object.keys(answers).length * 4))} defaultValue={JSON.stringify(answers, null, 2)} />
          <button className="btn btn-primary" type="submit">Save answers</button>
        </form>
      </section>
    </div>
  );
}
