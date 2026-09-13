// Generates the guestbook QR codes into public/qr/ (SVG + high-res PNG).
// Run: node scripts/generate-qr.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";

const BASE = "https://bilal-jennah-wedding.vercel.app";

const TARGETS = [
  { name: "guestbook", url: `${BASE}/guestbook` },
  { name: "guestbook-henna", url: `${BASE}/guestbook?event=henna` },
  { name: "guestbook-wedding", url: `${BASE}/guestbook?event=wedding` },
];

// Deep blue-gray from the site palette on white; M error correction keeps
// modules sparse (fast scans); 4-module quiet zone is the spec default.
const OPTS = {
  errorCorrectionLevel: "M",
  margin: 4,
  color: { dark: "#27343f", light: "#ffffff" },
};

const outDir = path.resolve("public", "qr");
await mkdir(outDir, { recursive: true });

for (const { name, url } of TARGETS) {
  const svg = await QRCode.toString(url, { ...OPTS, type: "svg" });
  await writeFile(path.join(outDir, `${name}.svg`), svg);
  const png = await QRCode.toBuffer(url, { ...OPTS, type: "png", width: 2048 });
  await writeFile(path.join(outDir, `${name}.png`), png);
  console.log(`✓ ${name} → ${url}`);
}
