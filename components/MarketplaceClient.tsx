"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import MarketplacePolicy from "@/components/MarketplacePolicy";
import WalletButton from "@/components/WalletButton";

type NativeMarketplaceListing = {
  id: string;
  collectionType: "pages" | "courtiers" | "royals" | null;
  sellerWallet: string;
  mintAddress: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  priceSol: number | null;
  saleStatus: string;
  custodyStatus: string;
  createdAt: string;
};

type MarketplaceCollection = {
  id: string;
  collectionName: string;
  chain: string;
  collectionAddress: string | null;
  description: string;
  previewImageUrls: string[];
  status: string;
  creator: {
    display_name?: string;
    wallet_address?: string;
  } | null;
  createdAt: string;
};

type MarketplaceItem =
  | {
      kind: "native";
      id: string;
      name: string;
      description: string;
      imageUrl: string | null;
      priceSol: number | null;
      collectionType: "pages" | "courtiers" | "royals" | null;
      sellerWallet: string;
      href: string;
      createdAt?: string;
    }
  | {
      kind: "collection";
      id: string;
      name: string;
      description: string;
      imageUrl: string | null;
      priceSol: null;
      chain: string;
      creatorLabel: string;
      creatorWallet: string | null;
      href: string;
      createdAt?: string;
    };

const filterOptions = [
  ["all", "All"],
  ["native", "Native Vertico NFTs"],
  ["external", "External Collections"],
  ["pages", "Pages"],
  ["courtiers", "Courtiers"],
  ["royals", "Royals"],
  ["approved", "Approved Collections"],
] as const;

const reportReasons = [
  "Illegal content",
  "Non-consensual content",
  "Rights issue",
  "Age/performer concern",
  "Stolen content",
  "Misleading listing",
  "Other",
];

function shortAddress(value?: string | null) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function collectionLabel(value?: NativeMarketplaceListing["collectionType"]) {
  if (value === "pages") return "Pages";
  if (value === "courtiers") return "Courtiers";
  if (value === "royals") return "Royals";
  return "Vertico";
}

function subscribeToAgeVerification(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getAgeVerificationSnapshot() {
  return localStorage.getItem("vertico_age_verified") === "true";
}

function getServerAgeVerificationSnapshot() {
  return false;
}

export default function MarketplaceClient() {
  const { publicKey } = useWallet();
  const [collections, setCollections] = useState<MarketplaceCollection[]>([]);
  const [nativeListings, setNativeListings] = useState<
    NativeMarketplaceListing[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<(typeof filterOptions)[number][0]>("all");
  const [sort, setSort] = useState("newest");
  const ageVerified = useSyncExternalStore(
    subscribeToAgeVerification,
    getAgeVerificationSnapshot,
    getServerAgeVerificationSnapshot
  );

  const walletAddress = publicKey?.toBase58();

  useEffect(() => {
    async function loadCollections() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/marketplace/collections/approved", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not load marketplace.");
        }

        setCollections(data.collections || []);
        setNativeListings(data.nativeListings || []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load marketplace."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadCollections();
  }, []);

  const items = useMemo<MarketplaceItem[]>(() => {
    const nativeItems: MarketplaceItem[] = nativeListings.map((listing) => ({
      kind: "native",
      id: listing.id,
      name: listing.name,
      description: listing.description,
      imageUrl: listing.imageUrl,
      priceSol: listing.priceSol,
      collectionType: listing.collectionType,
      sellerWallet: listing.sellerWallet,
      href: `/marketplace/listing/${listing.id}`,
      createdAt: listing.createdAt,
    }));

    const collectionItems: MarketplaceItem[] = collections.map((collection) => ({
      kind: "collection",
      id: collection.id,
      name: collection.collectionName,
      description: collection.description,
      imageUrl: collection.previewImageUrls[0] || null,
      priceSol: null,
      chain: collection.chain,
      creatorLabel:
        collection.creator?.display_name ||
        shortAddress(collection.creator?.wallet_address),
      creatorWallet: collection.creator?.wallet_address || null,
      href: `/marketplace/collection/${collection.id}`,
      createdAt: collection.createdAt,
    }));

    return [...nativeItems, ...collectionItems];
  }, [collections, nativeListings]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (activeFilter === "native") return item.kind === "native";
        if (activeFilter === "external") return item.kind === "collection";
        if (activeFilter === "approved") return item.kind === "collection";
        if (
          activeFilter === "pages" ||
          activeFilter === "courtiers" ||
          activeFilter === "royals"
        ) {
          return item.kind === "native" && item.collectionType === activeFilter;
        }
        return true;
      })
      .filter((item) => {
        if (!needle) return true;

        const haystack =
          item.kind === "native"
            ? [
                item.name,
                item.description,
                collectionLabel(item.collectionType),
                item.sellerWallet,
                shortAddress(item.sellerWallet),
              ]
            : [item.name, item.description, item.chain, item.creatorLabel];

        return haystack.join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "price_asc") {
          return (a.priceSol ?? Number.MAX_SAFE_INTEGER) - (b.priceSol ?? Number.MAX_SAFE_INTEGER);
        }
        if (sort === "price_desc") {
          return (b.priceSol ?? -1) - (a.priceSol ?? -1);
        }
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
  }, [activeFilter, items, search, sort]);

  async function reportContent(targetType: "collection" | "listing", targetId: string) {
    const reason = window.prompt(
      `Report reason:\n${reportReasons.join("\n")}`,
      "Misleading listing"
    );
    if (!reason?.trim()) return;

    const details = window.prompt("Details") || "";

    setReportMessage(null);

    try {
      const response = await fetch("/api/marketplace/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          reporterWallet: walletAddress,
          reason,
          details,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not create report.");
      }

      setReportMessage("Thank you. This report has been sent for review.");
    } catch (reportError) {
      setReportMessage(
        reportError instanceof Error
          ? reportError.message
          : "Could not create report."
      );
    }
  }

  function clearFilters() {
    setSearch("");
    setActiveFilter("all");
    setSort("newest");
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-amber-400">
            Back home
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/mint" className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10">
              Mint NFT
            </Link>
            <Link href="/mynfts" className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/10">
              My NFTs
            </Link>
            <Link href="/marketplace/apply" className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10">
              Apply as Creator
            </Link>
            <WalletButton />
          </div>
        </nav>

        <header className="py-12">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            18+ only
          </p>
          <h1 className="mt-3 text-5xl font-bold">Vertico Marketplace</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            Browse wallet-held native Vertico NFT listings and approved external
            collections. Purchase execution is not live yet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-300">
            <span className="rounded-full border border-emerald-400/30 px-3 py-1">
              {collections.length} approved collections
            </span>
            <span className="rounded-full border border-sky-400/30 px-3 py-1">
              {nativeListings.length} native listings
            </span>
          </div>
        </header>

        <MarketplacePolicy />

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, description, collection, or wallet"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-400"
          />
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-400"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name">Name A-Z</option>
          </select>
          <button
            onClick={clearFilters}
            className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/10"
          >
            Clear filters
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filterOptions.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveFilter(id)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                activeFilter === id
                  ? "border-amber-400 bg-amber-400 text-black"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-amber-400/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {reportMessage && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {reportMessage}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl border border-red-200/40 px-4 py-2 text-sm font-semibold hover:bg-red-400/10"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-300">
            Loading marketplace...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-bold">No marketplace listings yet.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-zinc-400">
              Mint a Vertico NFT, list one from My NFTs, or apply as a creator
              to submit an approved collection.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/mint" className="rounded-xl bg-amber-500 px-5 py-3 font-bold text-black hover:bg-amber-400">
                Mint NFT
              </Link>
              <Link href="/mynfts" className="rounded-xl border border-sky-400/40 px-5 py-3 font-bold text-sky-200 hover:bg-sky-400/10">
                My NFTs
              </Link>
              <Link href="/marketplace/apply" className="rounded-xl border border-emerald-400/40 px-5 py-3 font-bold text-emerald-200 hover:bg-emerald-400/10">
                Apply as Creator
              </Link>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-2xl font-bold">No results match this filter.</h2>
            <button
              onClick={clearFilters}
              className="mt-5 rounded-xl border border-white/15 px-5 py-3 font-bold text-zinc-200 hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <article key={`${item.kind}-${item.id}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <Link href={item.href} className="block">
                  <div className="aspect-[4/3] bg-black/40">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className={`h-full w-full object-cover ${ageVerified ? "" : "blur-2xl"}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-500">
                        No preview image
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-sky-300">
                        {item.kind === "native"
                          ? "Native Vertico NFT"
                          : "Approved Collection"}
                      </p>
                      <Link href={item.href} className="hover:text-amber-300">
                        <h2 className="mt-2 text-2xl font-bold">{item.name}</h2>
                      </Link>
                    </div>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {item.kind === "native" ? "Vertico Verified" : "Approved"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.kind === "native" ? (
                      <>
                        <span className="rounded-full border border-sky-400/30 px-3 py-1 text-xs font-semibold text-sky-200">
                          Wallet-held
                        </span>
                        <span className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200">
                          Ownership Verified
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="rounded-full border border-sky-400/30 px-3 py-1 text-xs font-semibold text-sky-200">
                          Creator Reviewed
                        </span>
                        <span className="rounded-full border border-red-400/30 px-3 py-1 text-xs font-semibold text-red-200">
                          Reportable
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mt-4 line-clamp-4 leading-7 text-zinc-300">
                    {item.description}
                  </p>
                  <div className="mt-5 grid gap-2 text-sm text-zinc-300">
                    {item.kind === "native" ? (
                      <>
                        <p>Collection: {collectionLabel(item.collectionType)}</p>
                        <p>Price: {item.priceSol === null ? "Price pending" : `${item.priceSol} SOL`}</p>
                        <p>Seller: {shortAddress(item.sellerWallet)}</p>
                        <p>Custody: Wallet-held</p>
                      </>
                    ) : (
                      <>
                        <p>Chain: {item.chain}</p>
                        <p>Creator: {item.creatorLabel}</p>
                      </>
                    )}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Link href={item.href} className="rounded-xl bg-amber-500 px-4 py-2 text-center text-sm font-bold text-black hover:bg-amber-400">
                      Details
                    </Link>
                    {item.kind === "collection" && item.creatorWallet && (
                      <Link
                        href={`/creators/${item.creatorWallet}`}
                        className="rounded-xl border border-sky-400/40 px-4 py-2 text-center text-sm font-semibold text-sky-200 hover:bg-sky-400/10"
                      >
                        View Creator
                      </Link>
                    )}
                    <button
                      onClick={() =>
                        reportContent(
                          item.kind === "native" ? "listing" : "collection",
                          item.id
                        )
                      }
                      className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-400/10"
                    >
                      Report
                    </button>
                  </div>
                  {item.kind === "native" && (
                    <button disabled className="mt-3 w-full rounded-xl bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300">
                      Buy Coming Soon
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
