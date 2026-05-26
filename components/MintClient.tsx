"use client";

import { useMemo, useState } from "react";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";
import { MINT_PRICES_SOL, type CollectionType } from "@/lib/mintPrices";

type MintAttribute = {
  trait_type: string;
  value: string;
};

type MintResult = {
  success: boolean;
  collection: string;
  name: string;
  description: string;
  attributes: MintAttribute[];
  mintAddress: string;
  recipient: string;
  paymentSignature: string;
  paymentAmountSol: number;
  treasuryWallet: string;
  metadataUri: string;
  imageUri: string;
  explorer: string;
  paymentExplorer: string;
  collectionExplorer: string;
};

const collections = [
  {
    id: "pages",
    name: "Pages",
    symbol: "PAGES",
    description: "Royal page collectibles with elegant traits and character lore.",
    price: `${MINT_PRICES_SOL.pages} devnet SOL`,
  },
  {
    id: "courtiers",
    name: "Courtiers",
    symbol: "COURTIERS",
    description: "Palace figures, diplomats, companions, and court personalities.",
    price: `${MINT_PRICES_SOL.courtiers} devnet SOL`,
  },
  {
    id: "royals",
    name: "Royals",
    symbol: "ROYALS",
    description: "Premium royal characters with rare traits and special identities.",
    price: `${MINT_PRICES_SOL.royals} devnet SOL`,
  },
];

export default function MintClient() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [selectedCollection, setSelectedCollection] =
    useState<CollectionType>("pages");
  const [isMinting, setIsMinting] = useState(false);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);

  const walletReady = connected && publicKey;

  const selected = useMemo(() => {
    return collections.find(
      (collection) => collection.id === selectedCollection
    );
  }, [selectedCollection]);

  async function handleMint() {
    if (!walletReady) {
      setMintError("Please connect your wallet first.");
      return;
    }

    const treasuryWallet = process.env.NEXT_PUBLIC_TREASURY_WALLET;

    if (!treasuryWallet) {
      setMintError("Missing NEXT_PUBLIC_TREASURY_WALLET in .env.local.");
      return;
    }

    setIsMinting(true);
    setMintError(null);
    setMintResult(null);

    try {
      const mintPriceSol = MINT_PRICES_SOL[selectedCollection];
      const lamports = Math.round(mintPriceSol * LAMPORTS_PER_SOL);

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(treasuryWallet),
          lamports,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();

      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      const paymentSignature = await sendTransaction(transaction, connection);

      await connection.confirmTransaction(
        {
          signature: paymentSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      const response = await fetch("/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collection: selectedCollection,
          walletAddress: publicKey.toBase58(),
          paymentSignature,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Mint failed.");
      }

      setMintResult(data);
    } catch (error) {
      setMintError(
        error instanceof Error ? error.message : "Unknown minting error."
      );
    } finally {
      setIsMinting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-5xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-sm font-semibold text-amber-400">
            ← Back home
          </a>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/mynfts"
              className="text-sm font-semibold text-emerald-400"
            >
              My NFTs →
            </a>

            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Devnet
            </span>

            <WalletButton />
          </div>
        </nav>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Mint
          </p>

          <h1 className="mt-3 text-5xl font-bold">Random NFT Mint</h1>

          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Choose a collection, pay with devnet SOL, and mint a random verified
            devnet NFT directly to your connected Phantom wallet.
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
            <p className="text-sm font-semibold text-zinc-400">
              Connected wallet
            </p>

            {walletReady ? (
              <p className="mt-2 break-all font-mono text-sm text-emerald-300">
                {publicKey.toBase58()}
              </p>
            ) : (
              <p className="mt-2 text-sm text-red-300">
                No wallet connected. Connect Phantom first.
              </p>
            )}
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold">Choose collection</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {collections.map((collection) => {
                const isSelected = selectedCollection === collection.id;

                return (
                  <button
                    key={collection.id}
                    onClick={() => {
                      if (!isMinting) {
                        setSelectedCollection(collection.id as CollectionType);
                        setMintResult(null);
                        setMintError(null);
                      }
                    }}
                    disabled={isMinting}
                    className={`rounded-2xl border p-5 text-left transition ${
                      isSelected
                        ? "border-amber-400 bg-amber-400/10"
                        : "border-white/10 bg-white/[0.03] hover:border-amber-400/50"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    <p className="text-sm font-semibold text-amber-400">
                      {collection.symbol}
                    </p>

                    <h3 className="mt-2 text-2xl font-bold">
                      {collection.name}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-zinc-400">
                      {collection.description}
                    </p>

                    <p className="mt-5 text-sm font-semibold text-zinc-300">
                      {collection.price}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-6">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">
              Selected
            </p>

            <h2 className="mt-2 text-3xl font-bold">{selected?.name}</h2>

            <p className="mt-3 text-zinc-400">{selected?.description}</p>

            <button
              onClick={handleMint}
              disabled={!walletReady || isMinting}
              className="mt-6 w-full rounded-xl bg-amber-500 px-6 py-4 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {isMinting
                ? "Processing Payment & Minting..."
                : walletReady
                  ? `Pay & Mint Random ${selected?.name} NFT`
                  : "Connect wallet to mint"}
            </button>

            <p className="mt-4 text-center text-xs text-zinc-500">
              Devnet only. This does not mint a mainnet NFT.
            </p>
          </div>

          {mintError && (
            <div className="mt-8 rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
              <p className="font-semibold text-red-300">Mint failed</p>
              <p className="mt-2 text-sm leading-6 text-red-200">
                {mintError}
              </p>
            </div>
          )}

          {mintResult && (
            <div className="mt-8 overflow-hidden rounded-3xl border border-emerald-400/30 bg-emerald-400/10 shadow-2xl">
              <div className="grid gap-0 lg:grid-cols-[320px_1fr]">
                <div className="bg-black/40 p-5">
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900">
                    <img
                      src={mintResult.imageUri}
                      alt={mintResult.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  {mintResult.attributes &&
                    mintResult.attributes.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
                          Attributes
                        </p>

                        <div className="space-y-2">
                          {mintResult.attributes.map((attribute) => (
                            <div
                              key={`${attribute.trait_type}-${attribute.value}`}
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
                </div>

                <div className="p-6">
                  <p className="font-semibold text-emerald-300">
                    Mint successful
                  </p>

                  <h3 className="mt-3 text-3xl font-bold text-white">
                    {mintResult.name}
                  </h3>

                  <p className="mt-2 text-lg text-zinc-300">
                    {mintResult.description}
                  </p>

                  <div className="mt-6 grid gap-4 text-sm">
                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Mint address</p>
                      <p className="mt-1 break-all font-mono text-zinc-200">
                        {mintResult.mintAddress}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Recipient wallet</p>
                      <p className="mt-1 break-all font-mono text-zinc-200">
                        {mintResult.recipient}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Payment amount</p>
                      <p className="mt-1 font-mono text-zinc-200">
                        {mintResult.paymentAmountSol} devnet SOL
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Payment transaction</p>
                      <p className="mt-1 break-all font-mono text-zinc-200">
                        {mintResult.paymentSignature}
                      </p>
                    </div>

                    <div className="rounded-xl bg-black/30 p-4">
                      <p className="text-zinc-500">Treasury wallet</p>
                      <p className="mt-1 break-all font-mono text-zinc-200">
                        {mintResult.treasuryWallet}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <a
                      href={mintResult.explorer}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-emerald-400 px-5 py-3 text-center font-bold text-black transition hover:bg-emerald-300"
                    >
                      View NFT on Explorer
                    </a>

                    <a
                      href={mintResult.paymentExplorer}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-emerald-400/40 px-5 py-3 text-center font-bold text-emerald-300 transition hover:bg-emerald-400/10"
                    >
                      View Payment
                    </a>

                    <a
                      href={mintResult.collectionExplorer}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/15 px-5 py-3 text-center font-bold text-white transition hover:bg-white/10"
                    >
                      View Collection
                    </a>

                    <a
                      href="/mynfts"
                      className="rounded-xl border border-amber-400/40 px-5 py-3 text-center font-bold text-amber-300 transition hover:bg-amber-400/10"
                    >
                      View My NFTs
                    </a>

                    <button
                      onClick={() => {
                        setMintResult(null);
                        setMintError(null);
                      }}
                      className="rounded-xl border border-white/15 px-5 py-3 text-center font-bold text-white transition hover:bg-white/10 sm:col-span-2"
                    >
                      Mint Another
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}