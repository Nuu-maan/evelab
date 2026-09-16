import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home screen icon: the diamond mark on the site's dark ink, square so iOS can round it. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <svg width="92" height="92" viewBox="0 0 20 20">
          <path d="M10 0L20 10L10 20L0 10Z" fill="#fafafa" />
        </svg>
      </div>
    ),
    size,
  );
}
