import Link from "next/link";

const prohibitedContent = [
  "Minors or age-ambiguous performers",
  "Non-consensual sexual content",
  "Stolen content",
  "Deepfakes or impersonation without rights or consent",
  "Sexual violence, coercion, exploitation, or trafficking",
  "Bestiality",
  "Illegal content",
  "Content that violates platform rules",
];

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-4xl">
        <nav className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/" className="text-amber-400">
            Home
          </Link>
          <Link href="/marketplace" className="text-sky-300">
            Marketplace
          </Link>
          <Link href="/marketplace/rules" className="text-zinc-300">
            Rules
          </Link>
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Safety
          </p>
          <h1 className="mt-3 text-5xl font-bold">Platform Safety</h1>
          <p className="mt-5 leading-8 text-zinc-300">
            Vertico is an 18+ adult digital collectibles platform built around
            moderation, reporting, and wallet-held testing. External collections
            are not instantly public.
          </p>
        </header>

        <div className="grid gap-5">
          {[
            "Creator applications and collection submissions require approval before public display.",
            "Users can report unsafe, illegal, misleading, or rights-infringing content.",
            "Moderators can hide or suspend listings, creators, and collections during review.",
            "Native Vertico marketplace listings are checked against seller wallet ownership.",
          ].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 leading-7 text-zinc-300"
            >
              {item}
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-2xl border border-red-400/20 bg-red-400/10 p-6">
          <h2 className="text-2xl font-bold">Prohibited Content</h2>
          <ul className="mt-5 grid gap-3 text-zinc-100">
            {prohibitedContent.map((item) => (
              <li key={item} className="rounded-xl bg-black/25 p-3">
                {item}
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  );
}
