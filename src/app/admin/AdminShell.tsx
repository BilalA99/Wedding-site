import Link from "next/link";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/rsvps", label: "RSVPs" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/invitations", label: "Invitations" },
] as const;

export function AdminShell({
  active,
  adminEmail,
  children,
}: {
  active: (typeof NAV)[number]["href"];
  adminEmail: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-charcoal">
      <header className="hairline border-b bg-charcoal-soft/40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-baseline gap-4">
            <span className="font-display text-xl text-ivory">B &amp; J</span>
            <span className="type-caps text-[0.6rem] text-sand/70">Admin</span>
          </div>
          <nav aria-label="Admin" className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={`type-caps rounded-full px-4 py-2 text-[0.62rem] transition-colors ${
                  active === item.href
                    ? "bg-gold/15 text-gold-soft"
                    : "text-ivory/60 hover:text-ivory"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-ivory/40 md:inline">
              {adminEmail}
            </span>
            <a
              href="/api/admin/export"
              className="type-caps hairline rounded-full border px-4 py-2 text-[0.62rem] text-ivory/80 hover:text-gold-soft"
            >
              Export CSV
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {children}
      </main>
    </div>
  );
}
