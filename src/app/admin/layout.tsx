import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Bilal Ahmad & Jennah Samhan",
  robots: { index: false, follow: false },
};

// Auth is enforced in middleware (session) and re-checked in every server
// action / data fetch via getAdminUser(). The login page renders its own shell.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
