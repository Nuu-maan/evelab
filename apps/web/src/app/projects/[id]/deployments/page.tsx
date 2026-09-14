import { ComingSoon } from "@/components/coming-soon";

export default function DeploymentsPage() {
  return <ComingSoon title="Deployments">Deploying to Vercel and following each deployment will land here.</ComingSoon>;
}

// The working deployments page, kept for when it ships.
// import Link from "next/link";
// import { DeployPanel } from "@/components/deploy-panel";
// import { Reveal } from "@/components/motion";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
// import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
// import { Input } from "@/components/ui/input";
// import { saveDeploySettingsAction } from "@/lib/actions";
// import { deployAvailability, readDeployState } from "@/lib/deploy";
// import { scanRequiredEnv } from "@/lib/env-scan";
// import { getProject } from "@/lib/workspace";
//
// export const dynamic = "force-dynamic";
//
// export default async function DeploymentsPage({ params }: { params: Promise<{ id: string }> }) {
//   const { id } = await params;
//   const [project, state] = await Promise.all([getProject(id), readDeployState(id)]);
//   const availability = deployAvailability();
//   const env = scanRequiredEnv(project.files);
//   const hasPlaceholderAuth = project.channels.some((channel) => channel.source.includes("placeholderAuth()"));
//
//   return (
//     <div className="page">
//       <Reveal>
//         <header className="page-header">
//           <div className="page-heading">
//             <h1 className="page-title">Deployments</h1>
//             <p className="page-description">
//               Deploys with <code className="mono">eve deploy</code>, exactly as from a terminal. Vercel runs the
//               agent with Workflow for durable sessions, Sandbox for its shell, Cron for schedules, and AI Gateway
//               for model calls through the project&apos;s OIDC token, so no provider key is needed.
//             </p>
//           </div>
//         </header>
//       </Reveal>
//
//       <Reveal delay={0.04}>
//         <Card>
//           <form action={saveDeploySettingsAction} className="contents">
//             <CardHeader>
//               <CardTitle>Vercel project</CardTitle>
//               <CardDescription>
//                 eve deploy links this project first, creating it if it does not exist. Stored with EveLab, not in the
//                 project.
//               </CardDescription>
//             </CardHeader>
//             <CardContent>
//               <input type="hidden" name="projectId" value={id} />
//               <div className="grid-2">
//                 <Field>
//                   <FieldLabel htmlFor="vercelProject">Project name</FieldLabel>
//                   <Input
//                     className="font-mono"
//                     id="vercelProject"
//                     name="project"
//                     defaultValue={state.settings.project ?? ""}
//                     placeholder={id}
//                   />
//                   <FieldDescription>Leave empty to use {id}.</FieldDescription>
//                 </Field>
//                 <Field>
//                   <FieldLabel htmlFor="vercelTeam">Team</FieldLabel>
//                   <Input className="font-mono" id="vercelTeam" name="team" defaultValue={state.settings.team ?? ""} placeholder="my-team" />
//                   <FieldDescription>Only when the token reaches more than one team.</FieldDescription>
//                 </Field>
//               </div>
//             </CardContent>
//             <CardFooter className="justify-end">
//               <Button type="submit" variant="outline">
//                 Save
//               </Button>
//             </CardFooter>
//           </form>
//         </Card>
//       </Reveal>
//
//       {(env.length > 0 || hasPlaceholderAuth) && (
//         <Reveal delay={0.08}>
//           <Card>
//             <CardHeader>
//               <CardTitle>Before the first deploy</CardTitle>
//               <CardDescription>Set these in the Vercel project&apos;s environment variables. EveLab never sees the values.</CardDescription>
//             </CardHeader>
//             <CardContent className="section">
//               {env.length > 0 && (
//                 <ul className="list" aria-label="Environment variables">
//                   {env.map((entry) => (
//                     <li className="list-item" key={entry.name}>
//                       <div className="flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
//                         <code className="mono">{entry.name}</code>
//                         <span className="list-item-detail mono truncate">{entry.files.join(", ")}</span>
//                       </div>
//                     </li>
//                   ))}
//                 </ul>
//               )}
//               {hasPlaceholderAuth && (
//                 <p className="hint">
//                   A channel still uses placeholderAuth(), which refuses browser requests in production.{" "}
//                   <Link href={`/projects/${id}/channels`}>Review channels</Link>.
//                 </p>
//               )}
//             </CardContent>
//           </Card>
//         </Reveal>
//       )}
//
//       <Reveal delay={0.12}>
//         <section className="section">
//           <h2 className="section-title">Production</h2>
//           <DeployPanel
//             projectId={id}
//             deployments={state.deployments}
//             available={availability.ok}
//             reason={availability.ok ? undefined : availability.reason}
//           />
//           <p className="hint">
//             Deployed sessions appear in the Vercel project under Observability, in the Agent Runs tab, when it is enabled
//             for your team.
//           </p>
//         </section>
//       </Reveal>
//     </div>
//   );
// }
