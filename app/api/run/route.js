import { NextResponse } from "next/server";
import { getRunState, startTask } from "@/src/lib/runner.js";
import { IS_VERCEL } from "@/src/lib/env.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...getRunState(), hosted: IS_VERCEL });
}

export async function POST(req) {
  if (IS_VERCEL) {
    return NextResponse.json({ ok: false, error: "Background tasks run on your own machine. Use the CLI: node src/cli.js run" }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  try {
    const run = startTask(body.task, body.params || {});
    return NextResponse.json({ ok: true, id: run.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
  }
}
