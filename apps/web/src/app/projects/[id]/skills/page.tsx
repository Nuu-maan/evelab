import Link from "next/link";
import { agentPath, skillFilePath, type SkillFormat } from "@evelab/eve-project";
import { IconBookOpen } from "@/components/icons";
import { ConfirmSubmit } from "@/components/confirm";
import { EmptyState } from "@/components/empty-state";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SkillImportButton } from "@/components/skill-import-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteEntityAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<SkillFormat, string> = {
  markdown: "Markdown",
  package: "Package",
  module: "defineSkill",
};

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);
  const base = project.root ? `${project.root}/` : "";

  return (
    <div className="page">
      <Reveal>
        <header className="page-header">
          <div className="page-heading">
            <h1 className="page-title">Skills</h1>
            <p className="page-description">
              What your agent knows how to do, loaded only when a task needs it. A skill is a markdown file
              or a directory with a SKILL.md under <code className="mono">{agentPath(project.root, "skills/")}</code>,
              and import shows you every file before anything is written.
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
            Paste a skills.sh link, an @skills/owner/repo/skill name, or a GitHub directory with a SKILL.md.
            EveLab reads every file, flags files that can run code, and installs only after you confirm.
          </EmptyState>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.skills.map((skill) => {
            const path = skillFilePath(base, skill);
            const removes = skill.format === "package" ? `${base}skills/${skill.id}/ and every file in it` : path;
            return (
              <StaggerItem key={skill.id}>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle className="font-mono">{skill.id}</CardTitle>
                    <CardDescription>{skill.description || "No description"}</CardDescription>
                    <CardAction className="flex items-center gap-2">
                      <Button asChild variant="ghost">
                        <Link href={`/projects/${id}/files?path=${encodeURIComponent(path)}`}>Edit</Link>
                      </Button>
                      <form action={deleteEntityAction}>
                        <input type="hidden" name="projectId" value={id} />
                        <input type="hidden" name="ref" value={`skill:${skill.id}`} />
                        <ConfirmSubmit title={`Remove ${skill.id}?`} description={`Deletes ${removes}.`} confirmLabel="Remove">
                          Remove
                        </ConfirmSubmit>
                      </form>
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <Badge variant="secondary">{FORMAT_LABELS[skill.format]}</Badge>
                    {skill.format === "package" && <Badge variant="secondary">{plural(skill.files.length + 1, "file")}</Badge>}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
