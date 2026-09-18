import Link from "next/link";
export default function NotFound() {
  return <div className="panel p-6 text-sm text-gray-300">Not found. <Link className="text-blue-300 underline" href="/jobs">Back to jobs</Link></div>;
}
