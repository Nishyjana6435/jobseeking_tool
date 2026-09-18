"use client";
import { useState } from "react";
import { importJobAction } from "@/app/actions.js";

export default function ImportJobForm() {
  const [busy, setBusy] = useState(false);
  return (
    <form action={async (fd) => { setBusy(true); try { await importJobAction(fd); } finally { setBusy(false); } }} className="panel flex flex-wrap items-center gap-2 p-3">
      <span className="text-sm text-gray-300">Add a job by URL</span>
      <input className="input flex-1 min-w-[280px]" name="url" type="url" placeholder="https://company.com/careers/job/123" required />
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Importing (about 30s)..." : "Import"}</button>
      <span className="text-xs text-gray-500">Fetches the page, extracts the posting with Claude, then opens it so you can score and prepare.</span>
    </form>
  );
}
