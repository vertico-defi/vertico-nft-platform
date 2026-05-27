import Link from "next/link";

const groups = [
  {
    title: "Public",
    links: [
      ["/", "Home"],
      ["/mint", "Mint"],
      ["/mynfts", "My NFTs"],
      ["/marketplace", "Marketplace"],
      ["/marketplace/how-it-works", "How It Works"],
      ["/marketplace/rules", "Rules"],
      ["/safety", "Safety"],
    ],
  },
  {
    title: "Marketplace",
    links: [
      ["/marketplace/apply", "Apply as Creator"],
      ["/marketplace/submit", "Submit Collection"],
    ],
  },
  {
    title: "Admin",
    links: [
      ["/dashboard", "Dashboard"],
      ["/admin/marketplace", "Marketplace Admin"],
      ["/admin/test-checklist", "Test Checklist"],
      ["/admin/diagnostics", "Diagnostics"],
    ],
  },
] as const;

export default function AdminRoutesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/admin/marketplace" className="text-amber-400">
            Marketplace Admin
          </Link>
          <Link href="/admin/diagnostics" className="text-sky-300">
            Diagnostics
          </Link>
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Admin QA
          </p>
          <h1 className="mt-3 text-5xl font-bold">Route Map</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Admin-oriented route map for manual devnet testing.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {groups.map((group) => (
            <section
              key={group.title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <h2 className="text-2xl font-bold">{group.title}</h2>
              <div className="mt-5 grid gap-3">
                {group.links.map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-zinc-200 hover:border-amber-400/50"
                  >
                    {label}
                    <span className="mt-1 block font-mono text-xs text-zinc-500">
                      {href}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
