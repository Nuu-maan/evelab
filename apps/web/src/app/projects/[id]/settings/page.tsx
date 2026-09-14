import Link from "next/link";
import { ConfirmSubmit } from "@/components/confirm";
import { VercelPlatformCard } from "@/components/vercel-platform-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProjectAction, disconnectRepositoryAction } from "@/lib/actions";
import { readGitState } from "@/lib/git";
import { getProject, projectLocation } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, git] = await Promise.all([getProject(id), readGitState(id)]);

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Settings</h1>
          <p className="page-description">The Vercel products this project runs on, where it lives, and how to remove it.</p>
        </div>
      </header>

      <VercelPlatformCard />

      <Card>
        <CardHeader>
          <CardTitle>On disk</CardTitle>
          <CardDescription>
            The project is a normal directory. Open it in your editor, run Eve against it, or put it
            under version control without EveLab.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="code mono">{projectLocation(id)}</pre>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {project.files.length} files. Set EVELAB_WORKSPACE to store projects elsewhere.
          </p>
        </CardFooter>
      </Card>

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
          <CardDescription>
            Deletes the directory and everything in it. There is no undo and no copy elsewhere.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-end">
          <form action={deleteProjectAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit
              variant="destructive"
              title={`Delete ${project.agent.name}?`}
              description={`This deletes ${projectLocation(id)} and all ${project.files.length} files in it. It cannot be undone.`}
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
