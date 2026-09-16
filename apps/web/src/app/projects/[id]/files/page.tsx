import { Suspense } from "react";
import { FileWorkbench } from "@/components/file-workbench";
import { FilesSkeleton } from "@/components/skeletons";
import { getProjectDirectories, getProjectFiles } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function FilesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [files, folders] = await Promise.all([getProjectFiles(id), getProjectDirectories(id)]);

  return (
    <Suspense fallback={<FilesSkeleton />}>
      <FileWorkbench projectId={id} files={files} folders={folders} />
    </Suspense>
  );
}
