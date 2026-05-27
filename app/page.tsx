import AgeGate from "@/components/AgeGate";
import WalletButton from "@/components/WalletButton";

const collections = [
  {
    name: "Pages",
    description: "Royal page collectibles with elegant traits and character lore.",
    href: "/collections/pages",
  },
  {
    name: "Courtiers",
    description: "Palace figures, diplomats, companions, and court personalities.",
    href: "/collections/courtiers",
  },
  {
    name: "Royals",
    description: "Premium royal characters with rare traits and special identities.",
    href: "/collections/royals",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <AgeGate />

      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">
              Vertico
            </p>
            <h1 className="text-xl font-bold">Digital Collectibles</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/marketplace"
              className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/10"
            >
              Marketplace
            </a>

            <a
              href="/marketplace/apply"
              className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              Apply
            </a>

            <a
              href="/mint"
              className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/10"
            >
              Mint
            </a>

            <a
              href="/mynfts"
              className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/10"
            >
              My NFTs
            </a>

            <WalletButton />
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.35em] text-zinc-400">
              Solana NFT Platform
            </p>

            <h2 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
              Royal digital collectibles built for the Solana ecosystem.
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
              Mint, collect, and access verified character NFTs across Pages,
              Courtiers, and Royals. This platform is currently running on
              Solana Devnet and is being prepared for mainnet deployment.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="#collections"
                className="rounded-xl bg-amber-500 px-6 py-3 text-center font-semibold text-black transition hover:bg-amber-400"
              >
                View Collections
              </a>

              <a
                href="/mint"
                className="rounded-xl border border-white/15 px-6 py-3 text-center font-semibold text-white transition hover:bg-white/10"
              >
                Start Minting
              </a>

              <a
                href="/mynfts"
                className="rounded-xl border border-emerald-400/40 px-6 py-3 text-center font-semibold text-emerald-300 transition hover:bg-emerald-400/10"
              >
                View My NFTs
              </a>

              <a
                href="/marketplace"
                className="rounded-xl border border-sky-400/40 px-6 py-3 text-center font-semibold text-sky-300 transition hover:bg-sky-400/10"
              >
                Marketplace
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-amber-500/30 via-zinc-900 to-purple-800/30 p-6">
              <div className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-amber-300">
                    Featured
                  </p>
                  <h3 className="mt-3 text-3xl font-bold">
                    Verified Collections
                  </h3>
                </div>

                <div className="space-y-3 text-sm text-zinc-300">
                  <p>Pages Collection</p>
                  <p>Courtiers Collection</p>
                  <p>Royals Collection</p>
                  <p className="pt-3 text-emerald-300">
                    Wallet-owned NFTs visible on-site
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <section id="collections" className="pb-20">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
              Collections
            </p>
            <h2 className="mt-2 text-3xl font-bold">Choose a collection</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <a
              href="/marketplace"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-sky-400/50 hover:bg-white/[0.06]"
            >
              <h3 className="text-2xl font-bold">Marketplace</h3>
              <p className="mt-3 leading-7 text-zinc-400">
                Approved adult digital collectible collections reviewed before
                public display.
              </p>
              <p className="mt-6 text-sm font-semibold text-sky-400">
                Browse Marketplace →
              </p>
            </a>

            <a
              href="/marketplace/apply"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-emerald-400/50 hover:bg-white/[0.06]"
            >
              <h3 className="text-2xl font-bold">Apply as Creator</h3>
              <p className="mt-3 leading-7 text-zinc-400">
                Submit a creator profile for admin review before listing any
                adult collection.
              </p>
              <p className="mt-6 text-sm font-semibold text-emerald-400">
                Start Application →
              </p>
            </a>

            <a
              href="/marketplace/submit"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-amber-400/50 hover:bg-white/[0.06]"
            >
              <h3 className="text-2xl font-bold">Submit Collection</h3>
              <p className="mt-3 leading-7 text-zinc-400">
                Approved creators can submit collections for moderation before
                public marketplace approval.
              </p>
              <p className="mt-6 text-sm font-semibold text-amber-400">
                Submit for Review →
              </p>
            </a>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {collections.map((collection) => (
              <a
                key={collection.name}
                href={collection.href}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-amber-400/50 hover:bg-white/[0.06]"
              >
                <h3 className="text-2xl font-bold">{collection.name}</h3>
                <p className="mt-3 leading-7 text-zinc-400">
                  {collection.description}
                </p>
                <p className="mt-6 text-sm font-semibold text-amber-400">
                  Explore {collection.name} →
                </p>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
