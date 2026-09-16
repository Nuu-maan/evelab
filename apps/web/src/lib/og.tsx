import { ImageResponse } from "next/og";
import { siteUrl } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/* The site's dark palette and canvas kind colours, as hex: the image renderer has no CSS variables. */
const INK = "#0a0a0a";
const PAPER = "#ededed";
const MUTED = "#a1a1a1";
const LINE = "#2e2e2e";
const KIND = { tool: "#47a8ff", skill: "#ffb224", connection: "#0ac7b4", channel: "#f75f8f" };

/**
 * Geist, as the site sets it. Fetched once when the image is generated; if the
 * network says no, the card still renders in the default face.
 */
async function geist(weight: number): Promise<ArrayBuffer | undefined> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Geist:wght@${weight}`).then((response) => response.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await fetch(url).then((response) => response.arrayBuffer()) : undefined;
  } catch {
    return undefined;
  }
}

function Diamond({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path d="M10 0L20 10L10 20L0 10Z" fill={color} />
    </svg>
  );
}

/** The mark's own idea, drawn large: an agent card with the pieces it uses wired underneath. */
function Diagram() {
  const tiles = [KIND.tool, KIND.skill, KIND.connection];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          width: 64,
          height: 64,
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${KIND.channel}`,
          borderRadius: 18,
          background: "#1a0d12",
        }}
      >
        <div style={{ display: "flex", width: 22, height: 16, border: `3px solid ${KIND.channel}`, borderRadius: 4 }} />
      </div>
      <div style={{ display: "flex", width: 2, height: 36, background: LINE }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          width: 300,
          height: 88,
          padding: "0 20px",
          border: `2px solid #5c5c5c`,
          borderRadius: 20,
          background: "#141414",
        }}
      >
        <div style={{ display: "flex", width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 14, background: PAPER }}>
          <Diamond size={24} color={INK} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", width: 150, height: 12, borderRadius: 6, background: "#5c5c5c" }} />
          <div style={{ display: "flex", width: 96, height: 10, borderRadius: 5, background: "#333333" }} />
        </div>
      </div>
      <div style={{ display: "flex", width: 2, height: 30, background: LINE }} />
      <div style={{ display: "flex", width: 220, height: 2, background: LINE }} />
      <div style={{ display: "flex", gap: 40 }}>
        {tiles.map((color) => (
          <div key={color} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", width: 2, height: 28, background: LINE }} />
            <div
              style={{
                display: "flex",
                width: 72,
                height: 72,
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${color}`,
                borderRadius: 36,
                background: "#111111",
              }}
            >
              <div style={{ display: "flex", width: 20, height: 20, borderRadius: 10, background: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A share card in the site's look: the mark and name, a headline, one plain line, and the agent diagram. */
export async function renderOgImage({ title, description }: { title: string[]; description: string }) {
  const [medium, semibold] = await Promise.all([geist(500), geist(600)]);
  const fonts = [
    ...(medium ? [{ name: "Geist", data: medium, weight: 500 as const, style: "normal" as const }] : []),
    ...(semibold ? [{ name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: INK, color: PAPER, fontFamily: "Geist" }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: 700, padding: "72px 0 64px 80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Diamond size={40} color={PAPER} />
            <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em" }}>evelab</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02 }}>
              {title.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            <div style={{ display: "flex", maxWidth: 560, fontSize: 30, fontWeight: 500, lineHeight: 1.35, color: MUTED }}>{description}</div>
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#707070" }}>{siteUrl().host}</div>
        </div>

        <div style={{ position: "relative", display: "flex", flex: 1, alignItems: "center", justifyContent: "center", paddingRight: 40 }}>
          <Diagram />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
