import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bilal Ahmad & Jennah Samhan — October 3–4, 2026";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fbfaf6",
          color: "#27343f",
          fontFamily: "Georgia, 'Bodoni MT', Didot, serif",
        }}
      >
        {/* eight-point tatreez star in dusty blue */}
        <svg width="76" height="76" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 2 L30 18 L46 24 L30 30 L24 46 L18 30 L2 24 L18 18 Z"
            stroke="#86a1b4"
            strokeWidth="1.25"
          />
          <path
            d="M24 12 L36 24 L24 36 L12 24 Z"
            stroke="#86a1b4"
            strokeWidth="1"
          />
        </svg>
        <div
          style={{
            marginTop: 44,
            fontSize: 72,
            letterSpacing: 1,
            display: "flex",
            alignItems: "baseline",
            gap: 26,
          }}
        >
          Bilal Ahmad
          <span
            style={{
              fontStyle: "italic",
              fontSize: 46,
              color: "#86a1b4",
              display: "flex",
            }}
          >
            &amp;
          </span>
          Jennah Samhan
        </div>
        <div
          style={{
            marginTop: 34,
            fontSize: 24,
            letterSpacing: 12,
            textTransform: "uppercase",
            color: "#5a6a75",
            fontFamily: "sans-serif",
            display: "flex",
          }}
        >
          October 3 – 4, 2026 · New York
        </div>
        <div
          style={{
            marginTop: 56,
            width: 320,
            height: 1,
            backgroundColor: "#d5e0e8",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
