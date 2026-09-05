import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bilal & Jennah — October 2026",
    short_name: "Bilal & Jennah",
    description: "Henna & Wedding — October 3–4, 2026, New York",
    start_url: "/",
    display: "standalone",
    background_color: "#17140f",
    theme_color: "#17140f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
