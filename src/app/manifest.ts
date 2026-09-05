import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bilal Ahmad & Jennah Samhan — October 2026",
    short_name: "Bilal & Jennah",
    description: "Henna & Wedding — October 3–4, 2026, New York",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf6",
    theme_color: "#fbfaf6",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
