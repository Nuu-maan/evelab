import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { IconInformation, IconSettingsSliders } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function RuntimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  const entries = Object.entries(project.agent.raw);
  const configPath = agentPath(project.root, "agent.ts");
  const href = `/projects/${id}/files?path=${encodeURIComponent(configPath)}`;
  const sandboxFile = [agentPath(project.root, "sandbox/sandbox.ts"), agentPath(project.root, "sandbox.ts")].find((path) =>
    project.files.some((file) => file.path === path),
  );
  const sandboxSource = project.files.find((file) => file.path === sandboxFile)?.content ?? "";
  const backend = /\b(vercel|docker|microsandbox|justbash)\(/.exec(sandboxSource)?.[1];
  const seedPrefix = agentPath(project.root, "sandbox/workspace/");
  const seeded = project.files.filter((file) => file.path.startsWith(seedPrefix)).map((file) => file.path.slice(seedPrefix.length));

  return (
    <div className="section" style={{ maxWidth: 680, width: "100%" }}>
      <Alert>
        <Icon icon={IconInformation} />
        <AlertTitle className="font-normal text-muted-foreground">
          Options such as limits, compaction, modelOptions and outputSchema are code, not settings. EveLab
          shows them here and never rewrites them, so they round trip exactly as written.
        </AlertTitle>
      </Alert>

      <section className="section">
        <h2 className="section-title">Sandbox</h2>
        <p className="page-description">
          {sandboxFile ? (
            <>
              Defined in <code className="mono">{sandboxFile}</code>
              {backend ? (
                <>
                  {" "}with the <code className="mono">{backend}()</code> backend.
                </>
              ) : (
                <>, using the default backend: Vercel Sandbox when deployed, Docker or a local backend in development.</>
              )}
            </>
          ) : (
            <>
              Eve&apos;s default sandbox: a bash environment at <code className="mono">/workspace</code> that runs on Vercel
              Sandbox when deployed, and on Docker or a local backend under eve dev.
            </>
          )}
          {sandboxSource.includes("deny-all") && " Network egress is denied."}
        </p>
        {seeded.length > 0 && (
          <ul className="list" aria-label="Seeded workspace files">
            {seeded.map((path) => (
              <li className="list-item" key={path}>
                <code className="mono">/workspace/{path}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      {entries.length === 0 ? (
        <EmptyState
          icon={IconSettingsSliders}
          title="No extra agent options."
          action={
            <Button asChild variant="outline">
              <Link href={href}>Open {configPath}</Link>
            </Button>
          }
        >
          Anything you add to defineAgent beyond model, reasoning and description shows up here.
        </EmptyState>
      ) : (
        <section className="section">
          <h2 className="section-title">Kept from {configPath}</h2>
          <ul className="list">
            {entries.map(([key, value]) => (
              <li className="list-item" key={key}>
                <code className="mono">{key}</code>
                <code className="mono list-item-detail">{value}</code>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="self-start">
            <Link href={href}>Edit in source</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
