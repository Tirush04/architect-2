import Link from "next/link";
import { LogoMark } from "@/components/logo";

export default function NotFound() {
  return (
    <main id="main" className="blueprint-grid flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-line bg-elev p-8 text-center shadow-card">
        <LogoMark className="mx-auto h-9 w-9" />
        <p className="annotation mt-6">Error 404 · sheet not found</p>
        <h1 className="mt-2 font-display text-4xl">This page isn&apos;t on the plan</h1>
        <p className="mt-3 text-sm text-ink-2">The link may be old, or the project was deleted.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/home" className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink hover:brightness-110">
            Go to projects
          </Link>
          <Link href="/" className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm hover:bg-sunken">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
