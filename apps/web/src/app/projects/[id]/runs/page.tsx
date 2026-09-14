import { ComingSoon } from "@/components/coming-soon";

export default function RunsPage() {
  return <ComingSoon title="Runs">Running your agent locally with eve dev and watching each session live will land here.</ComingSoon>;
}

// The working runs page, kept for when it ships.
// import { RunConsole } from "@/components/runs/run-console";
// import { listRuns, readRunEvents, sessionIdSchema } from "@/lib/runs";
// import { getRuntime, runtimeAvailable } from "@/lib/runtime";
//
// export const dynamic = "force-dynamic";
//
// export default async function RunsPage({
//   params,
//   searchParams,
// }: {
//   params: Promise<{ id: string }>;
//   searchParams: Promise<{ session?: string }>;
// }) {
//   const { id } = await params;
//   const { session } = await searchParams;
//   const sessionId = session && sessionIdSchema.safeParse(session).success ? session : undefined;
//   const [runs, events] = await Promise.all([listRuns(id), sessionId ? readRunEvents(id, sessionId) : []]);
//
//   return (
//     <RunConsole
//       key={sessionId ?? "new"}
//       projectId={id}
//       initialRuntime={getRuntime(id)}
//       allowed={runtimeAvailable()}
//       runs={runs}
//       sessionId={sessionId}
//       initialEvents={events}
//     />
//   );
// }
