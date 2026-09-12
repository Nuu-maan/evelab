import { InstructionsEditor } from "@/components/instructions-editor";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function InstructionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await readProject(id);

  return <InstructionsEditor projectId={id} initialContent={project.agent.instructions} />;
}
