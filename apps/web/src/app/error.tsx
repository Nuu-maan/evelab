"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";

/** A failed render. The digest matches the server log line, so a report can be traced. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <Mark />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Something went wrong</h1>
        <p className="max-w-[48ch] text-muted-foreground text-pretty">
          Your project files are unchanged. Try again, and if it keeps happening, include the reference below in a report.
        </p>
        {error.digest && <code className="font-mono text-[13px] text-muted-foreground">{error.digest}</code>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/projects">Go to projects</Link>
        </Button>
      </div>
    </main>
  );
}
