import NFTCard from "@/components/NFTCard";
import pagesData from "@/data/pages.json";

type PageTrait = {
  category: string;
  name: string;
};

type PageItem = {
  src: string;
  alt: string;
  traits: PageTrait[];
};

function parseAlt(alt: string) {
  const parts = alt.split("-").map((part) => part.trim());

  return {
    name: parts[0] || "Unnamed Page",
    description: parts.slice(1).join(" - ") || "Page",
  };
}

function imageFromSrc(src: string) {
  const match = src.match(/\d+/);
  const number = match ? match[0] : src;

  return `/assets/pages/${number}.png`;
}

function normalizePages(): PageItem[] {
  if (Array.isArray(pagesData)) return pagesData as PageItem[];
  if (Array.isArray((pagesData as any).Pages)) return (pagesData as any).Pages;
  if (Array.isArray((pagesData as any).pages)) return (pagesData as any).pages;
  if (Array.isArray((pagesData as any).data)) return (pagesData as any).data;

  return [];
}

export default function PagesCollection() {
  const pages = normalizePages();

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-7xl">
        <a href="/" className="text-sm font-semibold text-amber-400">
          ← Back home
        </a>

        <div className="my-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Collection
          </p>
          <h1 className="mt-2 text-5xl font-bold">Pages</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Royal page collectibles with elegant traits and character lore.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pages.map((page) => {
            const parsed = parseAlt(page.alt);

            return (
              <NFTCard
                key={page.src}
                name={parsed.name}
                description={parsed.description}
                imageSrc={imageFromSrc(page.src)}
                traits={(page.traits || []).map((trait) => ({
                  trait_type: trait.category,
                  value: trait.name,
                }))}
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}