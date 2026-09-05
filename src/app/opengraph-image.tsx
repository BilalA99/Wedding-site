import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bilal & Jennah — October 3–4, 2026";
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
          backgroundColor: "#17140f",
          color: "#f7f2e9",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* eight-point star */}
        <svg width="72" height="72" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 2 L30 18 L46 24 L30 30 L24 46 L18 30 L2 24 L18 18 Z"
            stroke="#b0955f"
            strokeWidth="1.25"
          />
          <path
            d="M24 12 L36 24 L24 36 L12 24 Z"
            stroke="#b0955f"
            strokeWidth="1"
          />
        </svg>
        <div
          style={{
            marginTop: 42,
            fontSize: 96,
            letterSpacing: 8,
            display: "flex",
          }}
        >
          Bilal &amp; Jennah
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 28,
            letterSpacing: 14,
            textTransform: "uppercase",
            color: "#c9b89a",
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
            backgroundColor: "#4e553c",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
