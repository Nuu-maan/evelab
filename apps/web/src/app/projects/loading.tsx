import { ProjectShellSkeleton } from "@/components/skeletons";

/** Shown while a project's shell is read; the projects list and forms have closer boundaries of their own. */
export default function Loading() {
  return <ProjectShellSkeleton />;
}
