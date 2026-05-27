import Link from "next/link";

export default function MarketplaceHowItWorksPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/marketplace" className="text-amber-400">
            Marketplace
          </Link>
          <Link href="/marketplace/rules" className="text-zinc-300">
            Rules
          </Link>
          <Link href="/safety" className="text-zinc-300">
            Safety
          </Link>
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Marketplace
          </p>
          <h1 className="mt-3 text-5xl font-bold">How It Works</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Vertico is in public devnet testing. Marketplace purchases are not
            active yet. Buy buttons are disabled while escrow and payment
            systems are under development.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-6">
            <h2 className="text-2xl font-bold">Native Vertico Listings</h2>
            <div className="mt-5 space-y-3 text-zinc-200">
              <p>Minted through Vertico.</p>
              <p>Wallet ownership is verified.</p>
              <p>Listed from My NFTs.</p>
              <p>Wallet-held for now.</p>
              <p>Buy functionality is coming later.</p>
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6">
            <h2 className="text-2xl font-bold">External Collections</h2>
            <div className="mt-5 space-y-3 text-zinc-200">
              <p>Creator applies.</p>
              <p>Collection is submitted.</p>
              <p>Admin review is required.</p>
              <p>Approved collections appear publicly.</p>
              <p>Reports and takedowns are supported.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
