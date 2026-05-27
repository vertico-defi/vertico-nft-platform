"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WalletButton from "@/components/WalletButton";

type Creator = {
  walletAddress: string;
  displayName: string | null;
  bio: string | null;
  websiteUrl: string | null;
  xUrl: string | null;
  status: "approved";
};

type CreatorCollection = {
  id: string;
  name: string;
  description: string;
  chain: string;
  imageUrl: string | null;
  collectionAddress: string | null;
};

function shortAddress(value?: string | null) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function safeUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function CreatorProfileClient({ wallet }: { wallet: string }) {
  const [creator, setCreator] = useState<Creator | null>(null);
  const [collections, setCollections] = useState<CreatorCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCreator() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/creators/${wallet}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Creator profile is not publicly available."
          );
        }

        setCreator(data.creator);
        setCollections(data.collections || []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Creator profile is not publicly available."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadCreator();
  }, [wallet]);

  const websiteUrl = safeUrl(creator?.websiteUrl || null);
  const xUrl = safeUrl(creator?.xUrl || null);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/marketplace" className="text-sm font-semibold text-amber-400">
            Back to Marketplace
          </Link>
          <WalletButton />
        </nav>

        {isLoading && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-300">
            Loading creator profile...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-3xl font-bold">Creator not found</h1>
            <p className="mt-3 text-zinc-400">
              This creator profile is not publicly available.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"
            >
              Retry
            </button>
          </div>
        )}

        {creator && (
          <>
            <header className="py-10">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Verified Creator
                </span>
                <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  Approved Creator
                </span>
              </div>
              <h1 className="mt-5 text-5xl font-bold">
                {creator.displayName || shortAddress(creator.walletAddress)}
              </h1>
              <p className="mt-3 break-all font-mono text-sm text-zinc-400">
                {shortAddress(creator.walletAddress)}
              </p>
              {creator.bio && (
                <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
                  {creator.bio}
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                {websiteUrl && (
                  <a
                    href={websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    Website
                  </a>
                )}
                {xUrl && (
                  <a
                    href={xUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10"
                  >
                    X
                  </a>
                )}
              </div>
            </header>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-zinc-400">Approved collections</p>
              <p className="mt-2 text-3xl font-bold">{collections.length}</p>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((collection) => (
                <article
                  key={collection.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <Link href={`/marketplace/collection/${collection.id}`}>
                    <div className="aspect-[4/3] bg-black/40">
                      {collection.imageUrl ? (
                        <img
                          src={collection.imageUrl}
                          alt={collection.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-500">
                          No preview image
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-5">
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      Approved Collection
                    </span>
                    <h2 className="mt-3 text-2xl font-bold">
                      {collection.name}
                    </h2>
                    <p className="mt-3 line-clamp-4 leading-7 text-zinc-300">
                      {collection.description}
                    </p>
                    <p className="mt-4 text-sm text-zinc-400">
                      Chain: {collection.chain}
                    </p>
                    <Link
                      href={`/marketplace/collection/${collection.id}`}
                      className="mt-5 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400"
                    >
                      View Collection
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
