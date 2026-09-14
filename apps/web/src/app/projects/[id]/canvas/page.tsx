import { CHAT_SDK_ADAPTERS, CHAT_SDK_STATES, getCanvasGraph, validateProject } from "@evelab/eve-project";
import { CanvasView } from "@/components/canvas/canvas-view";
import { readLayout } from "@/lib/layout";
import { DEFAULT_MODEL_ID, listModels } from "@/lib/models";
import { getProject } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function CanvasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, layout, models] = await Promise.all([getProject(id), readLayout(id), listModels()]);
  const graph = getCanvasGraph(project);

  // Node files are small and few; sending them with the page makes selecting a
  // node instant instead of a round trip.
  const byPath = new Map(project.files.map((file) => [file.path, file.content]));
  const contents: Record<string, string> = {};
  for (const node of graph.nodes) {
    contents[node.filePath] = byPath.get(node.filePath) ?? "";
  }

  const issues = validateProject(project).flatMap((issue) =>
    issue.level === "error" || issue.level === "warning" ? [{ level: issue.level, at: issue.at, message: issue.message }] : [],
  );

  return (
    <CanvasView
      projectId={id}
      graph={graph}
      contents={contents}
      positions={layout.positions}
      mode={layout.mode}
      collapsed={layout.collapsed}
      annotations={layout.annotations}
      wireStyle={layout.wireStyle}
      defaultModel={project.agent.model?.id || DEFAULT_MODEL_ID}
      models={models.map((model) => ({ id: model.id, label: model.label }))}
      root={project.root}
      issues={issues}
      chatSdkAdapters={Object.entries(CHAT_SDK_ADAPTERS).map(([key, value]) => ({ id: key, label: value.label, env: value.env }))}
      chatSdkStates={Object.entries(CHAT_SDK_STATES).map(([key, value]) => ({ id: key, label: value.label, env: value.env }))}
    />
  );
}
