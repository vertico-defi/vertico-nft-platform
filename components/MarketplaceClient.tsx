"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import MarketplacePolicy from "@/components/MarketplacePolicy";
import WalletButton from "@/components/WalletButton";

type MarketplaceListing = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  priceSol: number | null;
  status: string;
};

type NativeMarketplaceListing = {
  id: string;
  collectionType: "pages" | "courtiers" | "royals" | null;
  sellerWallet: string;
  ownerWallet: string | null;
  mintAddress: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  priceSol: number | null;
  saleStatus: string;
  custodyStatus: string;
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
  listings: MarketplaceListing[];
};

function shortAddress(value?: string | null) {
  if (!value) return "Unknown creator";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function collectionLabel(value?: NativeMarketplaceListing["collectionType"]) {
  if (value === "pages") return "Pages";
  if (value === "courtiers") return "Courtiers";
  if (value === "royals") return "Royals";
  return "Vertico";
}

function custodyLabel(value: string) {
  if (value === "wallet_held") return "Wallet-held";
  if (value === "escrowed") return "Escrowed";
  return value;
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

  const totalListings = useMemo(
    () =>
      collections.reduce(
        (count, collection) => count + collection.listings.length,
        nativeListings.length
      ),
    [collections, nativeListings.length]
  );

  async function reportContent(targetType: "collection" | "listing", targetId: string) {
    const reason = window.prompt("Report reason");
    if (!reason?.trim()) return;

    const details = window.prompt("Optional details") || "";

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

      setReportMessage("Report received. Admin moderation will review it.");
    } catch (reportError) {
      setReportMessage(
        reportError instanceof Error
          ? reportError.message
          : "Could not create report."
      );
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-amber-400">
            Back home
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/marketplace/apply"
              className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10"
            >
              Apply as Creator
            </a>
            <a
              href="/marketplace/submit"
              className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/10"
            >
              Submit Collection
            </a>
            <WalletButton />
          </div>
        </nav>

        <header className="py-12">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            18+ only
          </p>
          <h1 className="mt-3 text-5xl font-bold">Vertico Marketplace</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-300">
            Approved adult digital collectible collections. All public
            collections are reviewed before appearing here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-zinc-300">
            <span className="rounded-full border border-amber-400/30 px-3 py-1">
              {collections.length} approved collections
            </span>
            <span className="rounded-full border border-emerald-400/30 px-3 py-1">
              {totalListings} approved listings
            </span>
          </div>
        </header>

        <MarketplacePolicy />

        {reportMessage && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {reportMessage}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-5 text-red-100">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-300">
            Loading approved collections...
          </div>
        ) : collections.length === 0 && nativeListings.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-300">
            No approved marketplace collections are public yet.
          </div>
        ) : (
          <>
            {nativeListings.length > 0 && (
              <section className="mt-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-sky-300">
                      Vertico verified
                    </p>
                    <h2 className="mt-2 text-3xl font-bold">
                      Native Vertico NFTs
                    </h2>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-zinc-400">
                    These listings are wallet-held. Purchase execution is coming
                    later with escrow support.
                  </p>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {nativeListings.map((listing) => (
                    <article
                      key={listing.id}
                      className="overflow-hidden rounded-2xl border border-sky-400/20 bg-white/[0.03]"
                    >
                      <div className="aspect-[4/3] bg-black/40">
                        {listing.imageUrl ? (
                          <img
                            src={listing.imageUrl}
                            alt={listing.name}
                            className={`h-full w-full object-cover ${
                              ageVerified ? "" : "blur-2xl"
                            }`}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-zinc-500">
                            No preview image
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-sky-300">
                              Native Vertico NFT
                            </p>
                            <h3 className="mt-2 text-2xl font-bold">
                              {listing.name}
                            </h3>
                          </div>
                          <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                            Vertico Verified
                          </span>
                        </div>
                        <p className="mt-4 line-clamp-4 leading-7 text-zinc-300">
                          {listing.description}
                        </p>
                        <div className="mt-5 grid gap-2 text-sm text-zinc-300">
                          <p>Collection: {collectionLabel(listing.collectionType)}</p>
                          <p>
                            Price:{" "}
                            {listing.priceSol === null
                              ? "Price pending"
                              : `${listing.priceSol} SOL`}
                          </p>
                          <p>Seller: {shortAddress(listing.sellerWallet)}</p>
                          <p>Custody: {custodyLabel(listing.custodyStatus)}</p>
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <button
                            disabled
                            className="rounded-xl bg-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300"
                          >
                            Buy Coming Soon
                          </button>
                          <button
                            onClick={() => reportContent("listing", listing.id)}
                            className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-400/10"
                          >
                            Report
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {collections.length > 0 && (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {collections.map((collection) => {
              const imageUrl = collection.previewImageUrls[0];
              return (
                <article
                  key={collection.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="aspect-[4/3] bg-black/40">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={collection.collectionName}
                        className={`h-full w-full object-cover ${
                          ageVerified ? "" : "blur-2xl"
                        }`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-500">
                        No preview image
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold">
                          {collection.collectionName}
                        </h2>
                        <p className="mt-1 text-sm text-zinc-400">
                          {collection.creator?.display_name ||
                            shortAddress(collection.creator?.wallet_address)}
                        </p>
                      </div>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Approved Collection
                      </span>
                    </div>
                    <p className="mt-4 line-clamp-4 leading-7 text-zinc-300">
                      {collection.description}
                    </p>
                    <p className="mt-4 text-sm text-zinc-400">
                      Chain: {collection.chain}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      {collection.collectionAddress && (
                        <a
                          href={`https://explorer.solana.com/address/${collection.collectionAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/10"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => reportContent("collection", collection.id)}
                        className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-400/10"
                      >
                        Report
                      </button>
                    </div>

                    {collection.listings.length > 0 && (
                      <div className="mt-5 border-t border-white/10 pt-5">
                        <p className="text-sm font-semibold text-zinc-300">
                          Approved listings
                        </p>
                        <div className="mt-3 space-y-3">
                          {collection.listings.map((listing) => (
                            <div
                              key={listing.id}
                              className="rounded-xl border border-white/10 bg-black/25 p-3"
                            >
                              <div className="flex gap-3">
                                {listing.imageUrl ? (
                                  <img
                                    src={listing.imageUrl}
                                    alt={listing.name}
                                    className={`h-16 w-16 rounded-lg object-cover ${
                                      ageVerified ? "" : "blur-xl"
                                    }`}
                                  />
                                ) : (
                                  <div className="h-16 w-16 rounded-lg bg-zinc-800" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold">
                                    {listing.name}
                                  </p>
                                  <p className="mt-1 text-sm text-zinc-400">
                                    {listing.priceSol
                                      ? `${listing.priceSol} SOL`
                                      : "Price pending"}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    reportContent("listing", listing.id)
                                  }
                                  className="self-start rounded-lg border border-red-400/30 px-3 py-1 text-xs font-semibold text-red-200 hover:bg-red-400/10"
                                >
                                  Report
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
