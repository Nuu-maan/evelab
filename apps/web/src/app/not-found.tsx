import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not found", robots: { index: false } };

/** Also what a project answers to someone who may not open it, so the copy names both. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Mark />
      <div className="flex flex-col items-center gap-2">
        <p className="font-mono text-[13px] text-muted-foreground">404</p>
        <h1 className="text-2xl font-medium tracking-tight">This page does not exist</h1>
        <p className="max-w-[44ch] text-muted-foreground text-pretty">
          The link may be out of date, or the project may belong to another account.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/projects">Go to projects</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}
