import { loadConfig } from "@/src/lib/store.js";
import { saveConfigAction, saveApiKeyAction, saveAnswersAction } from "@/app/actions.js";
import { loadAnswers } from "@/src/linkedin/answers.js";

export default function SettingsPage() {
  const cfg = loadConfig();
  const key = process.env.ANTHROPIC_API_KEY || "";
  const masked = key ? `${key.slice(0, 12)}…${key.slice(-4)}` : "not set";
  const answers = loadAnswers();
  return (
    <div className="space-y-4">
      <section className="panel p-4">
        <h1 className="text-lg font-semibold text-white">Anthropic API key</h1>
        <p className="mt-1 text-sm text-gray-400">Stored in the project's .env file (gitignored) and used immediately. Current: <span className="font-mono text-gray-200">{masked}</span></p>
        <form action={saveApiKeyAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input className="input w-full max-w-xl font-mono" type="password" name="key" placeholder="sk-ant-api03-..." autoComplete="off" required />
          <button className="btn btn-primary" type="submit">Save key</button>
        </form>
      </section>

      <section className="panel p-4">
        <h2 className="text-base font-semibold text-white">Standing answers for application forms</h2>
        <p className="mt-1 text-sm text-gray-400">Used by LinkedIn Easy Apply before asking Claude. Edit the JSON values; keys are free-form hints.</p>
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
