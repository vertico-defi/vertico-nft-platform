import Link from "next/link";

const links = [
  ["Marketplace", "/marketplace"],
  ["My NFTs", "/mynfts"],
  ["Mint", "/mint"],
  ["Apply", "/marketplace/apply"],
  ["Submit", "/marketplace/submit"],
  ["How It Works", "/marketplace/how-it-works"],
  ["Safety", "/safety"],
  ["Rules", "/marketplace/rules"],
] as const;

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-zinc-950 px-6 py-6 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">Vertico devnet public test</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="font-semibold text-zinc-300 hover:text-amber-300"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
