"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";
import {
  type NativeListingState,
  type WalletNftEntry,
  useWalletNfts,
} from "@/hooks/useWalletNfts";

type CharacterHolding = {
  name: string;
  count: number;
  collection: "pages" | "courtiers" | "royals";
};

function formatDate(value?: string) {
  if (!value) {
    return "Found on-chain";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortAddress(value?: string) {
  if (!value) {
    return "Not recorded";
  }

  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function collectionLabel(collection: WalletNftEntry["collection"]) {
  if (collection === "pages") return "Pages";
  if (collection === "courtiers") return "Courtiers";
  return "Royals";
}

function getCollectorRank(totalOwned: number) {
  if (totalOwned >= 21) return "Palace Whale";
  if (totalOwned >= 11) return "Royal Patron";
  if (totalOwned >= 6) return "Court Insider";
  if (totalOwned >= 3) return "Court Guest";
  if (totalOwned >= 1) return "Visitor";
  return "Unranked";
}

function getNextRankTarget(totalOwned: number) {
  if (totalOwned < 1) return "Mint 1 NFT to become a Visitor.";
  if (totalOwned < 3) return `${3 - totalOwned} more NFT(s) to reach Court Guest.`;
  if (totalOwned < 6) return `${6 - totalOwned} more NFT(s) to reach Court Insider.`;
  if (totalOwned < 11) return `${11 - totalOwned} more NFT(s) to reach Royal Patron.`;
  if (totalOwned < 21) return `${21 - totalOwned} more NFT(s) to reach Palace Whale.`;
  return "Top collector rank reached.";
}

function subscribeToClientReady() {
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function uint8ArrayToBase64(value: Uint8Array) {
  let binary = "";

  for (let i = 0; i < value.length; i += 1) {
    binary += String.fromCharCode(value[i]);
  }

  return btoa(binary);
}

function stringToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  return uint8ArrayToBase64(bytes);
}

async function createListingAuthHeaders({
  walletAddress,
  lines,
  signMessage,
}: {
  walletAddress: string;
  lines: string[];
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}) {
  const message = [
    "Vertico Native Marketplace Listing",
    `Wallet: ${walletAddress}`,
    ...lines,
    `Timestamp: ${Date.now()}`,
    `Nonce: ${crypto.randomUUID()}`,
    "",
    "Sign this message to manage a wallet-held Vertico marketplace listing.",
  ].join("\n");
  const signature = await signMessage(new TextEncoder().encode(message));

  return {
    "x-wallet-message-base64": stringToBase64(message),
    "x-wallet-signature": uint8ArrayToBase64(signature),
  };
}

export default function MyNftsClient() {
  const { publicKey, connected, signMessage } = useWallet();
  const {
    nfts: history,
    stats,
    loading: isLoading,
    refreshing,
    error: loadError,
    listingStateByMint,
    listingStateLoading,
    listingStateError,
    refresh,
    refreshListingState,
    setListingStateForMint,
  } = useWalletNfts();

  const mounted = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot
  );
  const [listingMessage, setListingMessage] = useState<string | null>(null);
  const [listingPrices, setListingPrices] = useState<Record<string, string>>({});
  const [busyListingMint, setBusyListingMint] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<
    "all" | "pages" | "courtiers" | "royals"
  >("all");

  const walletAddress = publicKey?.toBase58();

  async function listingAuthHeaders(lines: string[]) {
    if (!walletAddress) throw new Error("Connect your wallet first.");
    if (!signMessage) throw new Error("This wallet does not support signing.");

    return createListingAuthHeaders({ walletAddress, lines, signMessage });
  }

  async function createListing(item: WalletNftEntry) {
    if (!walletAddress) {
      setListingMessage("Connect your wallet before listing.");
      return;
    }

    const priceSol = Number(listingPrices[item.mintAddress]);

    if (!Number.isFinite(priceSol) || priceSol <= 0) {
      setListingMessage("Enter a positive SOL price before listing.");
      return;
    }

    setBusyListingMint(item.mintAddress);
    setListingMessage(null);

    try {
      const authHeaders = await listingAuthHeaders([
        "Action: create_native_listing",
        `Mint: ${item.mintAddress}`,
        `Price SOL: ${priceSol}`,
      ]);
      const response = await fetch("/api/marketplace/listings/create-native", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          mintAddress: item.mintAddress,
          priceSol,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not create marketplace listing.");
      }

      setListingStateForMint(item.mintAddress, {
        listingId: data.listing.id,
        priceSol:
          data.listing.price_sol === null ? null : Number(data.listing.price_sol),
        saleStatus: data.listing.sale_status,
        status: data.listing.status,
      });
      setListingPrices((current) => ({ ...current, [item.mintAddress]: "" }));
      setListingMessage("Listed on marketplace.");
    } catch (error) {
      setListingMessage(
        error instanceof Error
          ? error.message
          : "Could not create marketplace listing."
      );
    } finally {
      setBusyListingMint(null);
    }
  }

  async function cancelListing(listing: NativeListingState, mintAddress: string) {
    if (!walletAddress) {
      setListingMessage("Connect your wallet before cancelling.");
      return;
    }

    setBusyListingMint(mintAddress);
    setListingMessage(null);

    try {
      const authHeaders = await listingAuthHeaders([
        "Action: cancel_native_listing",
        `Listing: ${listing.listingId}`,
      ]);
      const response = await fetch("/api/marketplace/listings/cancel-native", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          listingId: listing.listingId,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not cancel marketplace listing.");
      }

      setListingStateForMint(mintAddress, null);
      void refreshListingState();
      setListingMessage("Marketplace listing cancelled.");
    } catch (error) {
      setListingMessage(
        error instanceof Error
          ? error.message
          : "Could not cancel marketplace listing."
      );
    } finally {
      setBusyListingMint(null);
    }
  }

  const myNfts = useMemo(() => {
    return history.filter(
      (item) =>
        selectedCollection === "all" || item.collection === selectedCollection
    );
  }, [history, selectedCollection]);

  const myTotals = useMemo(() => {
    if (stats) return stats;

    return {
      total: history.length,
      pages: history.filter((item) => item.collection === "pages").length,
      courtiers: history.filter((item) => item.collection === "courtiers").length,
      royals: history.filter((item) => item.collection === "royals").length,
    };
  }, [history, stats]);

  const collectorRank = useMemo(() => {
    return getCollectorRank(myTotals.total);
  }, [myTotals.total]);

  const nextRankTarget = useMemo(() => {
    return getNextRankTarget(myTotals.total);
  }, [myTotals.total]);

  const characterHoldings = useMemo<CharacterHolding[]>(() => {
    const counts = new Map<string, CharacterHolding>();

    for (const item of history) {
      const key = `${item.collection}-${item.name}`;
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          name: item.name,
          count: 1,
          collection: item.collection,
        });
      }
    }

    return Array.from(counts.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }, [history]);

  const mostOwnedCharacter = characterHoldings[0];

  if (!mounted) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <section className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
              My NFTs
            </p>
            <h1 className="mt-3 text-5xl font-bold">Loading...</h1>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-7xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold text-amber-400">
            ← Back home
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/marketplace"
              className="text-sm font-semibold text-sky-400"
            >
              Go to Marketplace →
            </Link>
            <Link
              href="/mint"
              className="text-sm font-semibold text-emerald-400"
            >
              Mint NFT →
            </Link>
            <WalletButton />
          </div>
        </nav>

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Wallet Collection
          </p>

          <h1 className="mt-3 text-5xl font-bold">My NFTs</h1>

          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            View your Vertico devnet NFTs from your connected Phantom wallet.
            This page now scans Solana devnet ownership and enriches records
            with website mint history when available.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                Connected wallet
              </p>

              {connected && walletAddress ? (
                <p className="mt-2 break-all font-mono text-sm text-emerald-300">
                  {walletAddress}
                </p>
              ) : (
                <p className="mt-2 text-sm text-red-300">
                  Connect Phantom to view your NFTs.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {refreshing && (
                <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  Refreshing on-chain ownership...
                </span>
              )}
              {listingStateLoading && (
                <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                  Syncing listing state...
                </span>
              )}
              <button
                onClick={() => {
                  void refresh();
                  void refreshListingState();
                }}
                disabled={!connected || isLoading || refreshing}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Refresh NFTs
              </button>
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Devnet On-Chain Scan
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-zinc-400">Total Owned</p>
              <p className="mt-2 text-3xl font-bold">{myTotals.total}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-zinc-400">Pages</p>
              <p className="mt-2 text-3xl font-bold">{myTotals.pages}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-zinc-400">Courtiers</p>
              <p className="mt-2 text-3xl font-bold">{myTotals.courtiers}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <p className="text-sm text-zinc-400">Royals</p>
              <p className="mt-2 text-3xl font-bold">{myTotals.royals}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-3xl text-sm leading-6 text-sky-100">
              Browse the marketplace, view listed Vertico NFTs, and discover
              approved collections.
            </p>
            <Link
              href="/marketplace"
              className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-bold text-black hover:bg-sky-300"
            >
              View Marketplace
            </Link>
          </div>
        </div>

        {connected && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-amber-300">
                Collector Rank
              </p>

              <h2 className="mt-3 text-4xl font-bold text-white">
                {collectorRank}
              </h2>

              <p className="mt-3 text-sm leading-6 text-amber-100">
                {nextRankTarget}
              </p>

              <div className="mt-5 rounded-2xl bg-black/30 p-4">
                <p className="text-sm text-zinc-400">Rank system</p>
                <div className="mt-3 space-y-2 text-sm text-zinc-300">
                  <p>1–2 NFTs: Visitor</p>
                  <p>3–5 NFTs: Court Guest</p>
                  <p>6–10 NFTs: Court Insider</p>
                  <p>11–20 NFTs: Royal Patron</p>
                  <p>21+ NFTs: Palace Whale</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
              <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">
                Most Owned Character
              </p>

              {mostOwnedCharacter ? (
                <>
                  <h2 className="mt-3 text-3xl font-bold text-white">
                    {mostOwnedCharacter.name}
                  </h2>

                  <p className="mt-3 text-lg font-semibold text-emerald-200">
                    Owned x{mostOwnedCharacter.count}
                  </p>

                  <p className="mt-2 text-sm capitalize text-zinc-300">
                    Collection: {collectionLabel(mostOwnedCharacter.collection)}
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-3 text-3xl font-bold text-white">
                    No holdings yet
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-emerald-100">
                    Mint your first Vertico NFT to start building character
                    holdings.
                  </p>
                </>
              )}

              <div className="mt-5 rounded-2xl bg-black/30 p-4">
                <p className="text-sm text-zinc-400">Strategy</p>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Collecting is power inside Vertico. Stack characters, build
                  court influence, and strengthen your position before future
                  rewards and access mechanics go live.
                </p>
              </div>
            </div>
          </div>
        )}

        {connected && characterHoldings.length > 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-amber-400">
                  Holdings
                </p>
                <h2 className="mt-2 text-3xl font-bold">Character Counts</h2>
              </div>

              <p className="text-sm text-zinc-400">
                {characterHoldings.length} unique character
                {characterHoldings.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {characterHoldings.map((holding) => (
                <div
                  key={`${holding.collection}-${holding.name}`}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-amber-400">
                        {collectionLabel(holding.collection)}
                      </p>

                      <h3 className="mt-1 font-bold text-white">
                        {holding.name}
                      </h3>
                    </div>

                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-sm font-bold text-emerald-300">
                      x{holding.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {(["all", "pages", "courtiers", "royals"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedCollection(filter)}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold capitalize transition ${
                selectedCollection === filter
                  ? "border-amber-400 bg-amber-400 text-black"
                  : "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-amber-400/50"
              }`}
            >
              {filter === "all" ? "All" : filter}
            </button>
          ))}
        </div>

        {loadError && history.length === 0 && (
          <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
            <p className="font-semibold text-red-300">Could not load NFTs</p>
            <p className="mt-2 text-sm text-red-200">{loadError}</p>
          </div>
        )}

        {loadError && history.length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-100">
            Showing cached NFTs. Latest refresh failed: {loadError}
          </div>
        )}

        {listingStateError && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
            <p className="font-semibold text-amber-100">
              Marketplace listing state unavailable
            </p>
            <p className="mt-2 text-sm text-amber-100/80">
              {listingStateError}
            </p>
          </div>
        )}

        {listingMessage && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-100">
            {listingMessage}
          </div>
        )}

        {isLoading && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-zinc-400">
            Scanning wallet on Solana devnet...
          </div>
        )}

        {!connected && !isLoading && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-3xl font-bold">Connect your wallet</h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Connect the Phantom wallet that holds your Vertico NFTs. Your
              on-chain collection, rank, and character holdings will appear here.
            </p>

            <div className="mt-6 flex justify-center">
              <WalletButton />
            </div>
          </div>
        )}

        {connected && !isLoading && myNfts.length === 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
            <h2 className="text-3xl font-bold">No Vertico NFTs found</h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              This wallet does not currently hold any verified Vertico devnet
              NFTs from the known Pages, Courtiers, or Royals collections. You
              can mint your first NFT or browse the marketplace to see listed
              Vertico NFTs.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/mint"
                className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400"
              >
                Mint your first NFT
              </Link>
              <Link
                href="/marketplace"
                className="rounded-xl border border-sky-400/40 px-6 py-3 font-bold text-sky-200 transition hover:bg-sky-400/10"
              >
                View Marketplace
              </Link>
            </div>
          </div>
        )}

        {connected && myNfts.length > 0 && (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {myNfts.map((item) => (
              <NftCard
                key={item.id}
                item={item}
                activeListing={listingStateByMint[item.mintAddress]}
                busyListingMint={busyListingMint}
                listingPrice={listingPrices[item.mintAddress] || ""}
                walletAddress={walletAddress}
                onListingPriceChange={(value) =>
                  setListingPrices((current) => ({
                    ...current,
                    [item.mintAddress]: value,
                  }))
                }
                onCreateListing={() => createListing(item)}
                onCancelListing={(listing) =>
                  cancelListing(listing, item.mintAddress)
                }
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function NftCard({
  item,
  activeListing,
  busyListingMint,
  listingPrice,
  walletAddress,
  onListingPriceChange,
  onCreateListing,
  onCancelListing,
}: {
  item: WalletNftEntry;
  activeListing?: NativeListingState;
  busyListingMint: string | null;
  listingPrice: string;
  walletAddress?: string;
  onListingPriceChange: (value: string) => void;
  onCreateListing: () => void;
  onCancelListing: (listing: NativeListingState) => void;
}) {
  const isBusy = busyListingMint === item.mintAddress;
  const isOwnListing = Boolean(activeListing && walletAddress);

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-xl">
                <div className="aspect-[3/4] overflow-hidden bg-zinc-900">
                  {item.imageUri ? (
                    <img
                      src={item.imageUri}
                      alt={item.name}
                      className="h-full w-full object-cover transition duration-500 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-zinc-500">
                      Image unavailable from metadata URI
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-amber-400">
                        {collectionLabel(item.collection)}
                      </p>

                      <h2 className="mt-2 text-2xl font-bold">{item.name}</h2>
                    </div>

                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {item.source === "supabase" ? "Recorded" : "On-chain"}
                    </span>
                  </div>

                  <p className="mt-3 leading-6 text-zinc-400">
                    {item.description}
                  </p>

                  {item.attributes.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                        Attributes
                      </p>

                      <div className="space-y-2">
                        {item.attributes.map((attribute) => (
                          <div
                            key={`${item.id}-${attribute.trait_type}-${attribute.value}`}
                            className="flex justify-between gap-4 rounded-lg bg-black/40 px-3 py-2 text-sm"
                          >
                            <span className="text-zinc-400">
                              {attribute.trait_type}
                            </span>
                            <span className="text-right font-medium text-zinc-100">
                              {attribute.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid gap-3 text-sm">
                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Mint address</p>
                      <p className="mt-1 break-all font-mono text-xs text-zinc-200">
                        {item.mintAddress}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Payment record</p>
                      <p className="mt-1 text-zinc-200">
                        {item.paymentAmountSol && item.paymentAmountSol > 0
                          ? `${item.paymentAmountSol} devnet SOL`
                          : "Not in Supabase history"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Minted</p>
                      <p className="mt-1 text-zinc-200">
                        {formatDate(item.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <a
                      href={item.explorer}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-emerald-400 px-4 py-3 text-center text-sm font-bold text-black transition hover:bg-emerald-300"
                    >
                      NFT
                    </a>

                    <a
                      href={item.collectionExplorer}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
                    >
                      Collection
                    </a>

                    {item.paymentExplorer && (
                      <a
                        href={item.paymentExplorer}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-amber-400/40 px-4 py-3 text-center text-sm font-bold text-amber-300 transition hover:bg-amber-400/10 sm:col-span-2"
                      >
                        Payment
                      </a>
                    )}
                  </div>

                  <p className="mt-5 font-mono text-xs text-zinc-500">
                    Owner: {shortAddress(item.recipient)}
                  </p>
                </div>
      <div className="border-t border-white/10 bg-black/25 p-5">
        {activeListing ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                Already listed
              </span>
              <span className="text-sm font-semibold text-zinc-200">
                {activeListing.priceSol} SOL
              </span>
            </div>
            {isOwnListing && (
              <button
                onClick={() => onCancelListing(activeListing)}
                disabled={isBusy}
                className="mt-4 w-full rounded-xl border border-red-400/40 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? "Cancelling..." : "Cancel Listing"}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-6 text-zinc-300">
              This creates a public marketplace listing. Your NFT remains in
              your wallet until escrow sales are added.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
              <label>
                <span className="sr-only">Price in SOL</span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={listingPrice}
                  onChange={(event) =>
                    onListingPriceChange(event.target.value)
                  }
                  placeholder="Price in SOL"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-amber-400"
                />
              </label>
              <button
                onClick={onCreateListing}
                disabled={isBusy}
                className="rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isBusy ? "Listing..." : "List on Marketplace"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
