import { notFound } from "next/navigation";
import { loadJobs } from "@/src/lib/store.js";
import { loadCv } from "@/src/cv.js";
import CvView from "@/app/components/CvView.jsx";

export default async function CvPage({ params }) {
  const { id } = await params;
  const job = loadJobs()[decodeURIComponent(id)];
  if (!job) notFound();
  const cv = loadCv(job);
  return <CvView id={job.id} cv={cv} jobTitle={job.title} company={job.company} />;
}
