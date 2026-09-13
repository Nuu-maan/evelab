import Link from "next/link";
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

  return (
    <div className="section" style={{ maxWidth: 680, width: "100%" }}>
      <Alert>
        <Icon icon={IconInformation} />
        <AlertTitle className="font-normal text-muted-foreground">
          Runtime options have no GUI controls yet: EveLab only exposes settings once their Eve
          representation is confirmed, so that a GUI edit cannot silently rewrite semantics. Until
          then, edit them in the source and they round trip untouched.
        </AlertTitle>
      </Alert>

      {entries.length === 0 ? (
        <EmptyState
          icon={IconSettingsSliders}
          title="No extra agent options."
          action={
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/files?path=agent.ts`}>Open agent.ts</Link>
            </Button>
          }
        >
          Anything you add to the config object in agent.ts beyond name, description, model and
          instructions shows up here and is preserved on every save.
        </EmptyState>
      ) : (
        <section className="section">
          <h2 className="section-title">Preserved from agent.ts</h2>
          <ul className="list">
            {entries.map(([key, value]) => (
              <li className="list-item" key={key}>
                <code className="mono">{key}</code>
                <code className="mono list-item-detail">{value}</code>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="self-start">
            <Link href={`/projects/${id}/files?path=agent.ts`}>Edit in source</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
