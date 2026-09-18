import { NextResponse } from "next/server";
import { getRunState, startTask } from "@/src/lib/runner.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getRunState());
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    const run = startTask(body.task, body.params || {});
    return NextResponse.json({ ok: true, id: run.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
  }
}
