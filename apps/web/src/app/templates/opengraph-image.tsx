import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "Eve agent templates on evelab: import a real agent and see its canvas and code.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function TemplatesOpenGraphImage() {
  return renderOgImage({
    title: ["Start from a", "real Eve agent."],
    description: "Import a production-ready agent and ship it in minutes.",
  });
}
