"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="blueprint-grid flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-line bg-elev p-8 text-center shadow-card">
        <p className="annotation">Something went wrong</p>
        <h1 className="mt-2 font-display text-4xl">We hit a snag</h1>
        <p className="mt-3 text-sm text-ink-2">Your work is saved as checkpoints. Try again, or head back to your projects.</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-ink-3">ref {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <a href="/home" className="inline-flex h-9 items-center rounded-lg border border-line px-4 text-sm hover:bg-sunken">
            Projects
          </a>
        </div>
      </div>
    </main>
  );
}
