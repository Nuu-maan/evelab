import { OG_SIZE, renderOgImage } from "@/lib/og";

export const alt = "evelab: draw your agent, get real code. The open source visual IDE for AI agents.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return renderOgImage({
    title: ["Draw your agent.", "Get real code."],
    description: "Design AI agents on a canvas and ship real TypeScript you own.",
  });
}
