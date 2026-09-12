import Link from "next/link";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Skills</h1>
          <p className="page-description">
            Skills live under <code className="mono">skills/&lt;id&gt;/SKILL.md</code> and are read
            from disk, so a skill added by hand shows up here too.
          </p>
        </div>
      </header>

      {project.skills.length === 0 ? (
        <div className="empty">
          <p className="empty-title">No skills yet.</p>
          <p className="empty-body">
            Importing from GitHub and skills.sh is not built yet. When it is, an import will show the
            source and every file for review before anything is written, because importing code is
            not the same as trusting it.
          </p>
          <Link className="button" href={`/projects/${id}/files`}>
            Add one in Files
          </Link>
        </div>
      ) : (
        <ul className="list">
          {project.skills.map((skill) => (
            <li className="list-item" key={skill.id}>
              <div>
                <p className="list-item-title">{skill.name}</p>
                <p className="list-item-detail">
                  {skill.description || "No description"}
                  {skill.source ? ` · ${skill.source}` : ""}
                  {skill.files.length > 0 ? ` · ${skill.files.length} extra files` : ""}
                </p>
              </div>
              <Link
                className="button"
                data-variant="ghost"
                href={`/projects/${id}/files?path=skills/${skill.id}/SKILL.md`}
              >
                Open SKILL.md
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
