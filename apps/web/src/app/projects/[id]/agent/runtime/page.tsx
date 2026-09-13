import Link from "next/link";
import { agentPath } from "@evelab/eve-project";
import { IconInformation, IconSettingsSliders } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function RuntimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const entries = Object.entries(project.agent.raw);
  const configPath = agentPath(project.root, "agent.ts");
  const href = `/projects/${id}/files?path=${encodeURIComponent(configPath)}`;

  return (
    <div className="section" style={{ maxWidth: 680, width: "100%" }}>
      <Alert>
        <Icon icon={IconInformation} />
        <AlertTitle className="font-normal text-muted-foreground">
          Options such as limits, compaction, modelOptions and outputSchema are code, not settings. EveLab
          shows them here and never rewrites them, so they round trip exactly as written.
        </AlertTitle>
      </Alert>

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
