"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import MarketplacePolicy from "@/components/MarketplacePolicy";
import WalletButton from "@/components/WalletButton";

function linesToArray(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function MarketplaceSubmitClient() {
  const { publicKey, connected } = useWallet();
  const [collectionName, setCollectionName] = useState("");
  const [chain, setChain] = useState("Solana Devnet");
  const [collectionAddress, setCollectionAddress] = useState("");
  const [description, setDescription] = useState("");
  const [previewImageUrls, setPreviewImageUrls] = useState("");
  const [metadataSampleUrls, setMetadataSampleUrls] = useState("");
  const [rightsAttestation, setRightsAttestation] = useState(false);
  const [consentAttestation, setConsentAttestation] = useState(false);
  const [adultPerformerAttestation, setAdultPerformerAttestation] =
    useState(false);
  const [prohibitedContentAttestation, setProhibitedContentAttestation] =
    useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58();

  async function submitCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletAddress) {
      setMessage("Connect your wallet before submitting a collection.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/marketplace/collections/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          collectionName,
          chain,
          collectionAddress,
          description,
          previewImageUrls: linesToArray(previewImageUrls),
          metadataSampleUrls: linesToArray(metadataSampleUrls),
          rightsAttestation,
          consentAttestation,
          adultPerformerAttestation,
          prohibitedContentAttestation,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not submit collection.");
      }

      setMessage(
        "Collection submitted for admin review. It will not appear publicly unless approved."
      );
      setCollectionName("");
      setCollectionAddress("");
      setDescription("");
      setPreviewImageUrls("");
      setMetadataSampleUrls("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit collection."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-5xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/marketplace"
            className="text-sm font-semibold text-amber-400"
          >
            Back to marketplace
          </Link>
          <WalletButton />
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Moderated submission
          </p>
          <h1 className="mt-3 text-5xl font-bold">Submit Collection</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Creator approval is required before submitting a collection. Every
            collection stays private in pending review until an admin approves
            it for public marketplace display.
          </p>
          <div className="mt-6 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-5 text-sm leading-6 text-sky-100">
            Submitted collections are private until approved. Do not submit
            explicit previews if they cannot be safely gated or reviewed in the
            current UI. Use professional preview images where possible. All
            submissions are subject to review and removal.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Pending review", "Approved", "Rejected", "Suspended"].map(
              (status) => (
                <span
                  key={status}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300"
                >
                  {status}
                </span>
              )
            )}
          </div>
        </header>

        <MarketplacePolicy />

        <form
          onSubmit={submitCollection}
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="mb-6">
            <p className="text-sm font-semibold text-zinc-400">
              Connected wallet
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-200">
              {walletAddress || "Wallet connection required"}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Collection name
              </span>
              <input
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">Chain</span>
              <input
                value={chain}
                onChange={(event) => setChain(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-zinc-300">
                Collection address
              </span>
              <input
                value={collectionAddress}
                onChange={(event) => setCollectionAddress(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-zinc-300">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Preview image URLs, one per line
              </span>
              <textarea
                value={previewImageUrls}
                onChange={(event) => setPreviewImageUrls(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Metadata sample URLs, one per line
              </span>
              <textarea
                value={metadataSampleUrls}
                onChange={(event) => setMetadataSampleUrls(event.target.value)}
                rows={5}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
          </div>

          <div className="mt-6 space-y-3">
            {[
              [
                rightsAttestation,
                setRightsAttestation,
                "I own or control all rights for this collection.",
              ],
              [
                consentAttestation,
                setConsentAttestation,
                "I have verified consent for all depicted persons and intended uses.",
              ],
              [
                adultPerformerAttestation,
                setAdultPerformerAttestation,
                "All performers or depicted persons are 18 or older and not age-ambiguous.",
              ],
              [
                prohibitedContentAttestation,
                setProhibitedContentAttestation,
                "This collection contains no illegal, non-consensual, stolen, age-ambiguous, exploitative, or otherwise prohibited content.",
              ],
            ].map(([checked, setChecked, label]) => (
              <label
                key={label as string}
                className="flex gap-3 text-sm leading-6 text-zinc-200"
              >
                <input
                  type="checkbox"
                  checked={checked as boolean}
                  onChange={(event) =>
                    (setChecked as (next: boolean) => void)(event.target.checked)
                  }
                  className="mt-1"
                />
                {label as string}
              </label>
            ))}
          </div>

          {message && (
            <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              {message}
            </div>
          )}

          <button
            disabled={!connected || isSubmitting}
            className="mt-6 rounded-xl bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit for Review"}
          </button>
        </form>
      </section>
    </main>
  );
}
