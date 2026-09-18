import { loadJob, loadCv } from "@/src/lib/store.js";
import { buildDocx } from "@/src/lib/docx.js";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  const jobId = decodeURIComponent(id);
  const [job, cv] = await Promise.all([loadJob(jobId), loadCv(jobId)]);
  if (!job || !cv) return new Response("No tailored CV for this job yet", { status: 404 });
  const buf = await buildDocx(cv);
  const name = `${cv.name.replace(/\s+/g, "_")}_CV_${job.company.replace(/[^A-Za-z0-9]+/g, "_")}.docx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
