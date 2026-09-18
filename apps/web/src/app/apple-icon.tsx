import { ImageResponse } from "next/og";
import { MARK_VIEWBOX, MarkShapes } from "@/components/mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home screen icon: the mark on the site's dark ink, square so iOS can round it. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <svg width="100" height="100" viewBox={MARK_VIEWBOX}>
          {MarkShapes({ color: "#fafafa" })}
        </svg>
      </div>
    ),
    size,
  );
}
