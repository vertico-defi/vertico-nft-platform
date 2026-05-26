import NFTCard from "@/components/NFTCard";
import courtiersData from "@/data/courtiers.json";
import fs from "fs";
import path from "path";

type CourtierTrait = {
  category: string;
  name: string;
};

type CourtierItem = {
  CID: string;
  Name: string;
  Description: string;
  traits: CourtierTrait[];
};

const EXCLUDED_COURTIER_NAMES = ["Lady Amelia Wentworth"];

function normalizeCourtiers(): CourtierItem[] {
  let courtiers: CourtierItem[] = [];

  if (Array.isArray(courtiersData)) {
    courtiers = courtiersData as CourtierItem[];
  } else if (Array.isArray((courtiersData as any).Courtiers)) {
    courtiers = (courtiersData as any).Courtiers;
  } else if (Array.isArray((courtiersData as any).courtiers)) {
    courtiers = (courtiersData as any).courtiers;
  } else if (Array.isArray((courtiersData as any).data)) {
    courtiers = (courtiersData as any).data;
  }

  return courtiers.filter(
    (courtier) => !EXCLUDED_COURTIER_NAMES.includes(courtier.Name)
  );
}

function findCourtierImage(name: string) {
  const imageFolder = path.join(
    process.cwd(),
    "public",
    "assets",
    "courtiers"
  );

  const files = fs.readdirSync(imageFolder);

  const match = files.find((file) => {
    const fileNameWithoutExtension = path.parse(file).name;
    return fileNameWithoutExtension.toLowerCase() === name.toLowerCase();
  });

  if (!match) {
    return "/assets/placeholder.png";
  }

  return `/assets/courtiers/${encodeURIComponent(match)}`;
}

export default function CourtiersCollection() {
  const courtiers = normalizeCourtiers();

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

          <h1 className="mt-2 text-5xl font-bold">Courtiers</h1>

          <p className="mt-4 max-w-2xl text-zinc-400">
            Palace figures, diplomats, companions, and court personalities.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courtiers.map((courtier) => (
            <NFTCard
              key={courtier.CID}
              name={courtier.Name}
              description={courtier.Description}
              imageSrc={findCourtierImage(courtier.Name)}
              traits={(courtier.traits || []).map((trait) => ({
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