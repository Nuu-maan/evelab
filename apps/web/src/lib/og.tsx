import { ImageResponse } from "next/og";
import { MARK_VIEWBOX, MarkShapes } from "@/components/mark";
import { heroSceneImage } from "@/lib/og-scene";
import { siteUrl } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/* The site's dark palette, as hex: the image renderer has no CSS variables. */
const INK = "#0a0a0a";
const PAPER = "#ededed";
const MUTED = "#a1a1a1";
const FAINT = "#707070";

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

function Logo({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox={MARK_VIEWBOX}>
      {MarkShapes({ color })}
    </svg>
  );
}

/** A share card in the site's look: the mark and name, a headline, one short line, and the landing's isometric scene. */
export async function renderOgImage({ title, description }: { title: string[]; description: string }) {
  const [medium, semibold] = await Promise.all([geist(500), geist(600)]);
  const fonts = [
    ...(medium ? [{ name: "Geist", data: medium, weight: 500 as const, style: "normal" as const }] : []),
    ...(semibold ? [{ name: "Geist", data: semibold, weight: 600 as const, style: "normal" as const }] : []),
  ];
  const scene = heroSceneImage();
  const sceneHeight = 600;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%", background: INK, color: PAPER, fontFamily: "Geist" }}>
        <img src={scene.src} width={Math.round(sceneHeight * scene.ratio)} height={sceneHeight} style={{ position: "absolute", right: 40, top: 26 }} alt="" />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: 640, padding: "68px 0 60px 76px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Logo size={34} color={PAPER} />
            <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em" }}>evelab</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 600, letterSpacing: "-0.05em", lineHeight: 1.02 }}>
              {title.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
            <div style={{ display: "flex", maxWidth: 440, fontSize: 24, fontWeight: 500, lineHeight: 1.4, color: MUTED }}>{description}</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, fontWeight: 500, color: FAINT }}>{siteUrl().host}</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
