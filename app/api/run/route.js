import { NextResponse } from "next/server";
import { getRunState, startTask } from "@/src/lib/runner.js";
import { IS_VERCEL } from "@/src/lib/env.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const publicRun = (r) => r && { id: r.id, task: r.task, params: r.params, startedAt: r.startedAt, finishedAt: r.finishedAt, ok: r.ok, logs: r.logs };

export async function GET() {
  const s = getRunState();
  return NextResponse.json({ current: publicRun(s.current), history: s.history.map(publicRun), hosted: IS_VERCEL });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  let run;
  try {
    run = startTask(body.task, body.params || {});
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
  }
  if (!IS_VERCEL) return NextResponse.json({ ok: true, id: run.id });
  // Serverless: no background work survives the response, so wait for the task and return its log.
  await run.done;
  return NextResponse.json({ ok: run.ok, id: run.id, run: publicRun(run), error: run.ok ? undefined : run.logs.at(-1) });
}
