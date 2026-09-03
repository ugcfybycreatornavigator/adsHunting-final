import { ImageResponse } from "next/og";
import { SEO } from "@/lib/seo";

export const alt = "AdsHunting ad intelligence and competitor ad research platform";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#fcfcfa",
          color: "#161a16",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 82% 18%, rgba(104,179,47,.28), transparent 28%), radial-gradient(circle at 8% 78%, rgba(22,26,22,.08), transparent 24%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 72,
            right: 72,
            top: 70,
            bottom: 70,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid #d8ddd5",
            borderRadius: 34,
            padding: 56,
            background: "rgba(255,255,255,.72)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: "#68B32F",
              }}
            />
            AdsHunting
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                fontSize: 74,
                lineHeight: 0.98,
                fontWeight: 900,
                maxWidth: 870,
                letterSpacing: 0,
              }}
            >
              Ad intelligence for competitor creative research.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                lineHeight: 1.35,
                color: "#626862",
                maxWidth: 820,
              }}
            >
              {SEO.description}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
