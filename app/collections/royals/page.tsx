import NFTCard from "@/components/NFTCard";
import royalsData from "@/data/royals.json";
import fs from "fs";
import path from "path";

type RoyalTrait = {
  category: string;
  name: string;
};

type RoyalItem = {
  CID: string;
  Name: string;
  Description: string;
  traits: RoyalTrait[];
};

function normalizeRoyals(): RoyalItem[] {
  if (Array.isArray(royalsData)) return royalsData as RoyalItem[];

  if (Array.isArray((royalsData as any).Royals)) {
    return (royalsData as any).Royals;
  }

  if (Array.isArray((royalsData as any).royals)) {
    return (royalsData as any).royals;
  }

  if (Array.isArray((royalsData as any).data)) {
    return (royalsData as any).data;
  }

  return [];
}

function getImageNumberFromCID(cid: string) {
  const match = cid.match(/\d+/);
  return match ? match[0] : cid;
}

function findRoyalImage(cid: string) {
  const imageNumber = getImageNumberFromCID(cid);

  const imageFolder = path.join(
    process.cwd(),
    "public",
    "assets",
    "royals"
  );

  const files = fs.readdirSync(imageFolder);

  const match = files.find((file) => {
    const fileNameWithoutExtension = path.parse(file).name;
    return fileNameWithoutExtension === imageNumber;
  });

  if (!match) {
    return "/assets/placeholder.png";
  }

  return `/assets/royals/${encodeURIComponent(match)}`;
}

export default function RoyalsCollection() {
  const royals = normalizeRoyals();

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

          <h1 className="mt-2 text-5xl font-bold">Royals</h1>

          <p className="mt-4 max-w-2xl text-zinc-400">
            Premium royal characters with rare traits and special identities.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {royals.map((royal) => (
            <NFTCard
              key={royal.CID}
              name={royal.Name}
              description={royal.Description}
              imageSrc={findRoyalImage(royal.CID)}
              traits={(royal.traits || []).map((trait) => ({
                trait_type: trait.category,
                value: trait.name,
              }))}
            />
          ))}
        </div>
      </section>
    </main>
  );
}