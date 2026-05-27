"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import MarketplacePolicy from "@/components/MarketplacePolicy";
import WalletButton from "@/components/WalletButton";

export default function MarketplaceApplyClient() {
  const { publicKey, connected } = useWallet();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [ageAttested, setAgeAttested] = useState(false);
  const [rightsAttested, setRightsAttested] = useState(false);
  const [policyAcknowledged, setPolicyAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58();

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletAddress) {
      setMessage("Connect your wallet before applying.");
      return;
    }

    if (!policyAcknowledged) {
      setMessage("You must acknowledge the prohibited content policy.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/marketplace/creator/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          email,
          displayName,
          country,
          websiteUrl,
          xUrl,
          ageAttested,
          rightsAttested,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not submit application.");
      }

      setMessage(
        "Creator application submitted. Public listing remains disabled until admin approval."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not submit application."
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
            Creator review
          </p>
          <h1 className="mt-3 text-5xl font-bold">Apply as Creator</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Outside creators can apply to list adult digital collectible
            collections. No creator can publish publicly until Vertico admin
            approval is complete.
          </p>
        </header>

        <MarketplacePolicy />

        <form
          onSubmit={submitApplication}
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                Connected wallet
              </p>
              <p className="mt-2 break-all font-mono text-sm text-zinc-200">
                {walletAddress || "Wallet connection required"}
              </p>
            </div>
            {!connected && <WalletButton />}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Display name
              </span>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Country
              </span>
              <input
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-zinc-300">
                Website URL
              </span>
              <input
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-zinc-300">X URL</span>
              <input
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex gap-3 text-sm leading-6 text-zinc-200">
              <input
                type="checkbox"
                checked={ageAttested}
                onChange={(event) => setAgeAttested(event.target.checked)}
                className="mt-1"
              />
              I confirm I am 18+ and all depicted persons in submitted content
              are 18+.
            </label>
            <label className="flex gap-3 text-sm leading-6 text-zinc-200">
              <input
                type="checkbox"
                checked={rightsAttested}
                onChange={(event) => setRightsAttested(event.target.checked)}
                className="mt-1"
              />
              I own or control all rights necessary to submit and list this
              content.
            </label>
            <label className="flex gap-3 text-sm leading-6 text-zinc-200">
              <input
                type="checkbox"
                checked={policyAcknowledged}
                onChange={(event) => setPolicyAcknowledged(event.target.checked)}
                className="mt-1"
              />
              I acknowledge the prohibited content policy and understand that
              no CSAM, simulated CSAM, non-consensual, stolen, deepfake,
              coercive, exploitative, trafficking, bestiality, or illegal
              content is permitted.
            </label>
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
            {isSubmitting ? "Submitting..." : "Submit Creator Application"}
          </button>
        </form>
      </section>
    </main>
  );
}
