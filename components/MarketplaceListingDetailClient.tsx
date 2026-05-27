"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

type Attribute = {
  trait_type?: string;
  value?: string | number;
};

type Listing = {
  id: string;
  collectionType: "pages" | "courtiers" | "royals" | null;
  sellerWallet: string;
  mintAddress: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  attributes: Attribute[];
  priceSol: number | null;
  saleStatus: string;
  custodyStatus: string;
  ownershipStatus: string;
};

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

function collectionLabel(value: Listing["collectionType"]) {
  if (value === "pages") return "Pages";
  if (value === "courtiers") return "Courtiers";
  if (value === "royals") return "Royals";
  return "Vertico";
}

function custodyLabel(value: string) {
  return value === "wallet_held" ? "Wallet-held" : value;
}

export default function MarketplaceListingDetailClient({
  listingId,
}: {
  listingId: string;
}) {
  const { publicKey } = useWallet();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadListing() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/marketplace/listings/${listingId}`, {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not load listing.");
        }

        setListing(data.listing);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load listing."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadListing();
  }, [listingId]);

  async function submitReport() {
    setReportMessage(null);

    try {
      const response = await fetch("/api/marketplace/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "listing",
          targetId: listingId,
          reporterWallet: publicKey?.toBase58(),
          reason,
          details,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not submit report.");
      }

      setDetails("");
      setReportMessage("Thank you. This report has been sent for review.");
    } catch (reportError) {
      setReportMessage(
        reportError instanceof Error
          ? reportError.message
          : "Could not submit report."
      );
    }
  }

  const explorerUrl = listing?.mintAddress
    ? `https://explorer.solana.com/address/${listing.mintAddress}?cluster=devnet`
    : null;

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
            Loading listing...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-red-100">
            <p>{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl border border-red-200/40 px-4 py-2 text-sm font-semibold hover:bg-red-400/10"
            >
              Retry
            </button>
          </div>
        )}

        {listing && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              {listing.imageUrl ? (
                <img
                  src={listing.imageUrl}
                  alt={listing.name}
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center text-zinc-500">
                  No preview image
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  Native Vertico NFT
                </span>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Vertico Verified
                </span>
                <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                  Wallet-held
                </span>
                <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Ownership Verified
                </span>
              </div>

              <h1 className="mt-5 text-5xl font-bold">{listing.name}</h1>
              <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
                {listing.description}
              </p>

              <div className="mt-6 rounded-2xl border border-sky-400/30 bg-sky-400/10 p-5 text-sm leading-6 text-sky-100">
                This is a wallet-held listing. The NFT remains in the seller's
                wallet until escrow sales are added.
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Info label="Collection" value={collectionLabel(listing.collectionType)} />
                <Info
                  label="Price"
                  value={listing.priceSol === null ? "Price pending" : `${listing.priceSol} SOL`}
                />
                <Info label="Seller" value={shortAddress(listing.sellerWallet)} mono />
                <Info label="Mint" value={shortAddress(listing.mintAddress)} mono />
                <Info label="Custody" value={custodyLabel(listing.custodyStatus)} />
                <Info label="Sale status" value={listing.saleStatus} />
                <Info label="Ownership status" value="Seller currently owns this NFT" />
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                  >
                    Explorer
                  </a>
                )}
                <button
                  disabled
                  className="rounded-xl bg-zinc-700 px-5 py-3 text-sm font-bold text-zinc-300"
                >
                  Buy Coming Soon
                </button>
              </div>

              {listing.attributes.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-2xl font-bold">Attributes</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {listing.attributes.map((attribute, index) => (
                      <div
                        key={`${attribute.trait_type}-${attribute.value}-${index}`}
                        className="rounded-xl border border-white/10 bg-black/30 p-4"
                      >
                        <p className="text-sm text-zinc-500">
                          {attribute.trait_type || "Trait"}
                        </p>
                        <p className="mt-1 font-semibold text-zinc-100">
                          {String(attribute.value || "Unknown")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
                <h2 className="text-xl font-bold">Report listing</h2>
                <div className="mt-4 grid gap-3">
                  <select
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-red-300"
                  >
                    {reportReasons.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <textarea
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Details"
                    rows={3}
                    className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-red-300"
                  />
                  <button
                    onClick={submitReport}
                    className="rounded-xl border border-red-400/40 px-4 py-3 text-sm font-bold text-red-100 hover:bg-red-400/10"
                  >
                    Report
                  </button>
                </div>
                {reportMessage && (
                  <p className="mt-3 text-sm text-red-100">{reportMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Info({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 break-all text-zinc-100 ${mono ? "font-mono text-xs" : "font-semibold"}`}>
        {value}
      </p>
    </div>
  );
}
