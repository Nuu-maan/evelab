import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = "EveLab, an open source visual IDE for Eve agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card: the mark, the name and what EveLab is, on the site's own dark background. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          background: "#0a0a0a",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div style={{ width: "56px", height: "56px", background: "#fafafa", transform: "rotate(45deg)" }} />
          <div style={{ fontSize: "84px", fontWeight: 600, letterSpacing: "-3px" }}>{SITE_NAME}</div>
        </div>
        <div style={{ marginTop: "40px", maxWidth: "900px", fontSize: "38px", lineHeight: 1.35, color: "#a1a1a1" }}>
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size,
  );
}
