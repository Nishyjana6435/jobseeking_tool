import { notFound } from "next/navigation";
import { loadJob, loadCv } from "@/src/lib/store.js";
import CvView from "@/app/components/CvView.jsx";

export default async function CvPage({ params }) {
  const { id } = await params;
  const jobId = decodeURIComponent(id);
  const [job, cv] = await Promise.all([loadJob(jobId), loadCv(jobId)]);
  if (!job) notFound();
  return <CvView id={job.id} cv={cv} jobTitle={job.title} company={job.company} />;
}
