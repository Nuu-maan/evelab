import { getCanvasGraph } from "@evelab/eve-project";
import { CanvasView } from "@/components/canvas/canvas-view";
import { readLayout } from "@/lib/layout";
import { readProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, layout] = await Promise.all([readProject(id), readLayout(id)]);
  const graph = getCanvasGraph(project);

  // Node files are small and few; sending them with the page makes selecting a
  // node instant instead of a round trip.
  const byPath = new Map(project.files.map((file) => [file.path, file.content]));
  const contents: Record<string, string> = {};
  for (const node of graph.nodes) {
    contents[node.filePath] = byPath.get(node.filePath) ?? "";
  }

  return (
    <CanvasView
      projectId={id}
      graph={graph}
      contents={contents}
      positions={layout.positions}
      defaultModel={project.agent.model.id}
    />
  );
}
