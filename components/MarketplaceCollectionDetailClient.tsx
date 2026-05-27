"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

type Collection = {
  id: string;
  collectionName: string;
  chain: string;
  collectionAddress: string | null;
  description: string;
  previewImageUrls: string[];
  status: string;
  creator: {
    display_name?: string | null;
    wallet_address?: string | null;
  } | null;
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
  if (!value) return "Unknown creator";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export default function MarketplaceCollectionDetailClient({
  collectionId,
}: {
  collectionId: string;
}) {
  const { publicKey } = useWallet();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState(reportReasons[0]);
  const [details, setDetails] = useState("");
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCollection() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/marketplace/collections/${collectionId}`,
          { cache: "no-store" }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not load collection.");
        }

        setCollection(data.collection);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load collection."
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadCollection();
  }, [collectionId]);

  async function submitReport() {
    setReportMessage(null);

    try {
      const response = await fetch("/api/marketplace/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType: "collection",
          targetId: collectionId,
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

  const explorerUrl =
    collection?.chain.toLowerCase() === "solana" && collection.collectionAddress
      ? `https://explorer.solana.com/address/${collection.collectionAddress}?cluster=devnet`
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
            Loading collection...
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

        {collection && (
          <div className="mt-8">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Approved Collection
              </span>
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Moderation Reviewed
              </span>
              <span className="rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-200">
                Creator Reviewed
              </span>
              <span className="rounded-full border border-red-400/40 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-200">
                Reportable
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-bold">
              {collection.collectionName}
            </h1>
            <p className="mt-3 text-zinc-400">
              {collection.creator?.display_name ||
                shortAddress(collection.creator?.wallet_address)}
            </p>
            <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
              {collection.description}
            </p>

            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
              This collection has been approved for public display after
              moderation review. Approval is not financial advice or a guarantee
              of off-platform activity.
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="Chain" value={collection.chain} />
              <Info
                label="Collection address"
                value={collection.collectionAddress || "Not provided"}
                mono
              />
            </div>

            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Explorer
              </a>
            )}
            {collection.creator?.wallet_address && (
              <Link
                href={`/creators/${collection.creator.wallet_address}`}
                className="ml-0 mt-5 inline-flex rounded-xl border border-sky-400/40 px-5 py-3 text-sm font-bold text-sky-200 hover:bg-sky-400/10 sm:ml-3"
              >
                View Creator
              </Link>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {collection.previewImageUrls.map((imageUrl) => (
                <div
                  key={imageUrl}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                >
                  <img
                    src={imageUrl}
                    alt={collection.collectionName}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
              ))}
              {collection.previewImageUrls.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-400">
                  No preview images available.
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
              <h2 className="text-xl font-bold">Report collection</h2>
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
