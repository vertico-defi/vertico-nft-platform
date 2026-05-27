import Link from "next/link";

const rules = [
  "18+ only.",
  "Creators must own or control the rights to submitted content.",
  "Illegal, non-consensual, stolen, or age-ambiguous content is not permitted.",
  "Creators and sellers must not misrepresent collections, ownership, or status.",
  "Reports can lead to review, suspension, hiding, or removal.",
  "Native listings must remain owned by the seller wallet.",
];

export default function MarketplaceRulesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <nav className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/marketplace" className="text-amber-400">
            Marketplace
          </Link>
          <Link href="/marketplace/how-it-works" className="text-zinc-300">
            How It Works
          </Link>
          <Link href="/safety" className="text-zinc-300">
            Safety
          </Link>
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Rules
          </p>
          <h1 className="mt-3 text-5xl font-bold">Marketplace Rules</h1>
          <p className="mt-5 leading-8 text-zinc-300">
            These rules apply to creator applications, collection submissions,
            native listings, and public marketplace display.
          </p>
        </header>

        <div className="grid gap-4">
          {rules.map((rule) => (
            <div
              key={rule}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-zinc-200"
            >
              {rule}
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 leading-7 text-amber-100">
          Vertico may remove or hide content during review.
        </div>
      </section>
    </main>
  );
}
