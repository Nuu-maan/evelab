import Link from "next/link";
import { listProjects } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <main className="main">
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="page-title">Projects</h1>
            <p className="page-description">
              Every project is a real Eve project on disk. Open it here or keep working in your
              editor.
            </p>
          </div>
          <Link className="button" data-variant="primary" href="/projects/new">
            New project
          </Link>
        </header>

        {projects.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No projects yet.</p>
            <p className="empty-body">
              Create an Eve project to choose a model, write instructions, and add tools. You can
              export it to GitHub at any point.
            </p>
            <Link className="button" href="/projects/new">
              Create project
            </Link>
          </div>
        ) : (
          <ul className="list">
            {projects.map((project) => (
              <li className="list-item" key={project.id}>
                <div>
                  <Link className="list-item-title" href={`/projects/${project.id}`}>
                    {project.name}
                  </Link>
                  <p className="list-item-detail">
                    {project.model || "No model set"} · {project.toolCount} tools ·{" "}
                    {project.skillCount} skills · {project.subagentCount} subagents
                  </p>
                </div>
                <Link className="button" data-variant="ghost" href={`/projects/${project.id}/files`}>
                  Files
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
