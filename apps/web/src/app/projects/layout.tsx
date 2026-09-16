import type { Metadata } from "next";

/**
 * Everything under /projects is a person's private workspace. It is never
 * indexed, even where it renders without sign-in, such as a local evelab.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
