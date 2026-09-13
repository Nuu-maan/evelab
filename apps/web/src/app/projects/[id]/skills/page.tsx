import Link from "next/link";
import { IconBookOpen } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SkillImportButton } from "@/components/skill-import-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteSkillAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Skills</h1>
            <p className="page-description">
              What your agent knows how to do. Each skill is a directory under{" "}
              <code className="mono">skills/</code> with a SKILL.md, and import shows you every file
              before anything is written.
            </p>
          </div>
          <div className="page-actions">
            <SkillImportButton projectId={id} />
          </div>
        </header>
      </Reveal>

      {project.skills.length === 0 ? (
        <Reveal delay={0.06}>
          <EmptyState
            icon={IconBookOpen}
            title="No skills yet."
            action={<SkillImportButton projectId={id} label="Import your first skill" variant="ghost" />}
          >
            Paste a GitHub link to a directory containing SKILL.md. EveLab reads it, flags files that
            can run code, and installs only after you confirm.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.skills.map((skill) => (
            <StaggerItem key={skill.id}>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>{skill.name}</CardTitle>
                  <CardDescription>{skill.description || "No description"}</CardDescription>
                  <CardAction className="flex items-center gap-2">
                    <Button asChild variant="ghost">
                      <Link href={`/projects/${id}/files?path=skills/${skill.id}/SKILL.md`}>Edit</Link>
                    </Button>
                    <form action={deleteSkillAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="skillId" value={skill.id} />
                      <ConfirmSubmit
                        title={`Remove ${skill.name}?`}
                        description={`Deletes skills/${skill.id}/ and every file in it.`}
                        confirmLabel="Remove"
                      >
                        Remove
                      </ConfirmSubmit>
                    </form>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Badge variant="secondary">{plural(skill.files.length + 1, "file")}</Badge>
                  {skill.source && (
                    <a className="hint mono truncate" href={skill.source} target="_blank" rel="noreferrer noopener">
                      {skill.source}
                    </a>
                  )}
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
