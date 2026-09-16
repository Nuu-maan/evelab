import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "evelab: draw your agent, get real code. The open source visual IDE for AI agents.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function TwitterImage() {
  return renderOgImage({
    title: ["Draw your agent.", "Get real code."],
    description: "The open source visual IDE for AI agents. Design on a canvas, ship real TypeScript.",
  });
}
