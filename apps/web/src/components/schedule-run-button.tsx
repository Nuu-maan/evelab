import { Button } from "@/components/ui/button";

/** Running a schedule opens its run, and runs are not wired up yet, so the button waits. */
export function ScheduleRunButton(_props: { projectId: string; scheduleId: string }) {
  return (
    <Button variant="outline" size="sm" disabled title="Coming soon">
      Run now
      <span className="soon-tag">Soon</span>
    </Button>
  );
}

// The working button, kept for when runs ship.
// "use client";
//
// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
//
// /** Fires a schedule once on the dev server and opens the run it starts. */
// export function ScheduleRunButton({ projectId, scheduleId }: { projectId: string; scheduleId: string }) {
//   const router = useRouter();
//   const [pending, setPending] = useState(false);
//   const [error, setError] = useState<string>();
//
//   const run = async () => {
//     setPending(true);
//     setError(undefined);
//     const response = await fetch(`/api/projects/${projectId}/schedules/run`, {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({ scheduleId }),
//     });
//     const data = (await response.json().catch(() => ({}))) as { sessionIds?: string[]; error?: string };
//     setPending(false);
//     const [sessionId] = data.sessionIds ?? [];
//     if (!response.ok || !sessionId) {
//       setError(data.error ?? "The schedule did not start.");
//       return;
//     }
//     router.push(`/projects/${projectId}/runs?session=${encodeURIComponent(sessionId)}`);
//   };
//
//   return (
//     <>
//       <Button variant="outline" size="sm" disabled={pending} onClick={() => void run()}>
//         Run now
//       </Button>
//       {error && (
//         <span className="form-error" role="alert">
//           {error}
//         </span>
//       )}
//     </>
//   );
// }
