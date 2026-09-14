import Link from "next/link";
import { InstructionsEditor } from "@/components/instructions-editor";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function InstructionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);

  const path = project.agent.instructionsPath || (project.root ? `${project.root}/instructions.md` : "instructions.md");
  const others = project.agent.instructionSources;
  const codeFile = project.root ? `${project.root}/instructions.ts` : "instructions.ts";
  // Instructions written in code have no markdown file to edit, and Eve rejects adding one beside them.
  if (!project.files.some((file) => file.path === path) && others.includes(codeFile)) {
    return (
      <p className="hint">
        This agent writes its instructions in code, at{" "}
        <Link className="mono" href={`/projects/${id}/files?path=${encodeURIComponent(codeFile)}`}>
          {codeFile}
        </Link>
        . Edit them in Files.
      </p>
    );
  }
  return (
    <>
      <InstructionsEditor projectId={id} initialContent={project.agent.instructions} path={path} />
      {others.length > 0 && (
        <p className="hint mt-3">
          Eve combines this file with{" "}
          {others.map((source, index) => (
            <span key={source}>
              {index > 0 ? ", " : ""}
              <Link className="mono" href={`/projects/${id}/files?path=${encodeURIComponent(source)}`}>
                {source}
              </Link>
            </span>
          ))}
          , in filename order. Edit those in Files.
        </p>
      )}
    </>
  );
}
