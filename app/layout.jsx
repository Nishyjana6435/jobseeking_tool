import "./globals.css";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Job Tracker", description: "CV-driven job search and application tracker" };

const nav = [
  ["/", "Dashboard"],
  ["/jobs", "Jobs"],
  ["/tracker", "Tracker"],
  ["/profile", "Profile"],
  ["/fill-sheet", "Fill sheet"],
  ["/settings", "Settings"],
];

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-gray-800 bg-[var(--panel)]">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-semibold tracking-tight text-white">Job Tracker</Link>
            <nav className="flex gap-4 text-sm text-gray-300">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className="hover:text-white">{label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
