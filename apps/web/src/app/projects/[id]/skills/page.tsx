import Link from "next/link";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { SkillImportButton } from "@/components/skill-import-button";
import { deleteSkillAction } from "@/lib/actions";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function SkillsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return (
    <div className="page">
      <Reveal>
        <header className="page-header page-header-centered">
          <p className="page-eyebrow">Skills</p>
          <h1 className="page-title">What your agent knows how to do</h1>
          <p className="page-description">
            Each skill is a directory under <code className="mono">skills/</code> with a SKILL.md.
            Import shows you the source and every file before anything is written.
          </p>
          <SkillImportButton projectId={id} />
        </header>
      </Reveal>

      {project.skills.length === 0 ? (
        <Reveal delay={0.06}>
          <div className="empty">
            <p className="empty-title">No skills yet.</p>
            <p className="empty-body">
              Paste a GitHub link to a directory containing SKILL.md. EveLab reads it, flags files
              that can run code, and installs only after you confirm.
            </p>
            <SkillImportButton projectId={id} label="Import your first skill" />
          </div>
        </Reveal>
      ) : (
        <Stagger className="section">
          {project.skills.map((skill) => (
            <StaggerItem key={skill.id}>
              <div className="card" data-interactive="true">
                <div className="row-between">
                  <div>
                    <p className="card-title">{skill.name}</p>
                    <p className="card-detail">{skill.description || "No description"}</p>
                  </div>
                  <div className="row">
                    <Link
                      className="button"
                      data-variant="ghost"
                      href={`/projects/${id}/files?path=skills/${skill.id}/SKILL.md`}
                    >
                      Edit
                    </Link>
                    <form action={deleteSkillAction}>
                      <input type="hidden" name="projectId" value={id} />
                      <input type="hidden" name="skillId" value={skill.id} />
                      <button className="button" data-variant="danger" type="submit">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
                <div className="row">
                  <span className="badge">{skill.files.length + 1} files</span>
                  {skill.source && (
                    <a
                      className="palette-hint mono"
                      href={skill.source}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {skill.source}
                    </a>
                  )}
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
