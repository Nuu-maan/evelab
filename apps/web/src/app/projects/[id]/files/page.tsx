import { Suspense } from "react";
import { FileWorkbench } from "@/components/file-workbench";
import { readProjectFiles } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const files = await readProjectFiles(id);

  return (
    <Suspense fallback={<div className="page">Loading files</div>}>
      <FileWorkbench projectId={id} files={files} />
    </Suspense>
  );
}
