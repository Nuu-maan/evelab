import { zipSync, type Zippable } from "fflate";
import { guardProject } from "@/lib/api";
import { readProjectFileBytes, readProjectFiles } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * The project as a zip of its real files, inside a folder named after it, ready
 * to unpack and run with `eve dev`. Dependencies, build output and Git internals
 * stay out, as they do everywhere else EveLab reads a project.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await guardProject(id);
  if (denied) return denied;

  const files = await readProjectFiles(id);
  // Bytes rather than the decoded text, so images and other binary files survive the round trip.
  const entries = await Promise.all(
    files.map(async (file) => [file.path, await readProjectFileBytes(id, file.path)] as const),
  );
  const tree: Zippable = {};
  for (const [path, bytes] of entries) tree[`${id}/${path}`] = bytes;
  const zip = zipSync(tree, { level: 6, mtime: new Date() });

  return new Response(new Blob([zip.slice().buffer as ArrayBuffer], { type: "application/zip" }), {
    headers: {
      "content-disposition": `attachment; filename="${id}.zip"`,
      "cache-control": "no-store",
    },
  });
}
