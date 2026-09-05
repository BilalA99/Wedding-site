import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Instrument_Sans } from "next/font/google";

import { SITE_DESCRIPTION, SITE_TITLE } from "@/config/wedding";

import "./globals.css";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-bodoni",
  display: "swap",
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  robots: { index: false, follow: false },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    url: "/",
    siteName: "Bilal Ahmad & Jennah Samhan",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bilal Ahmad & Jennah Samhan",
  },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${instrument.variable}`}>
      <body>
        <a
          href="#events"
          className="type-caps sr-only z-100 rounded-sm bg-paper px-4 py-3 text-xs text-ink focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to events
        </a>
        {children}
      </body>
    </html>
  );
}
