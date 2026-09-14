import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProjectAction, disconnectRepositoryAction } from "@/lib/actions";
import { readGitState } from "@/lib/git";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, git] = await Promise.all([getProject(id), readGitState(id)]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Settings</h1>
          <p className="page-description">The repository this project is linked to, and how to remove it.</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Repository</CardTitle>
          <CardDescription>
            {git ? (
              <>
                Connected to{" "}
                <a className="mono text-foreground underline-offset-4 hover:underline" href={git.url} target="_blank" rel="noreferrer noopener">
                  {git.repository}
                </a>{" "}
                on <span className="mono">{git.branch}</span>. Disconnecting only forgets the link:
                nothing changes on GitHub or in the project files.
              </>
            ) : (
              "Not connected. Connect an existing repository or create one from Source control."
            )}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          {git ? (
            <form action={disconnectRepositoryAction}>
              <input type="hidden" name="projectId" value={id} />
              <Button variant="outline" type="submit">
                Disconnect repository
              </Button>
            </form>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/projects/${id}/source`}>Open source control</Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Delete project</CardTitle>
          <CardDescription>Deletes the project and all its files from EveLab. There is no undo.</CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit
              variant="destructive"
              title={`Delete ${project.agent.name}?`}
              description={`This deletes all ${project.files.length} files in ${project.agent.name}. A connected GitHub repository is not touched. It cannot be undone.`}
              confirmLabel="Delete project"
            >
              Delete {project.agent.name}
            </ConfirmSubmit>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
