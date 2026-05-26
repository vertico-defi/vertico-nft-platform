"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

type MintAttribute = {
  trait_type: string;
  value: string;
};

type MintHistoryEntry = {
  id: string;
  timestamp: string;
  network: "devnet";
  collection: "pages" | "courtiers" | "royals";
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

type DashboardResponse = {
  success: boolean;
  history: MintHistoryEntry[];
  totals: {
    totalMints: number;
    totalSolCollected: number;
    pages: number;
    courtiers: number;
    royals: number;
  };
  error?: string;
};

const ADMIN_WALLET = "znwtFnSfXnaCDfkpTUwaE5eKFa9ENTa763LV88cqJSN";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function collectionLabel(collection: MintHistoryEntry["collection"]) {
  if (collection === "pages") return "Pages";
  if (collection === "courtiers") return "Courtiers";
  return "Royals";
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

function createAdminMessage(wallet: string) {
  return [
    "Vertico Admin Dashboard Access",
    `Wallet: ${wallet}`,
    `Timestamp: ${Date.now()}`,
    `Nonce: ${crypto.randomUUID()}`,
    "",
    "Sign this message to view the Vertico admin dashboard.",
  ].join("\n");
}

export default function AdminDashboardClient() {
  const { publicKey, connected, signMessage } = useWallet();

  const [history, setHistory] = useState<MintHistoryEntry[]>([]);
  const [totals, setTotals] = useState<DashboardResponse["totals"]>({
    totalMints: 0,
    totalSolCollected: 0,
    pages: 0,
    courtiers: 0,
    royals: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const walletAddress = publicKey?.toBase58();
  const isAdminWallet = walletAddress === ADMIN_WALLET;

  const recentMints = useMemo(() => {
    return history.slice(0, 20);
  }, [history]);

  async function loadDashboard() {
    if (!walletAddress) {
      setLoadError("Connect the admin wallet first.");
      return;
    }

    if (!isAdminWallet) {
      setLoadError("Connected wallet is not authorized for this dashboard.");
      return;
    }

    if (!signMessage) {
      setLoadError("This wallet does not support message signing.");
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const message = createAdminMessage(walletAddress);
      const encodedMessage = new TextEncoder().encode(message);
      const signedMessage = await signMessage(encodedMessage);

      const messageBase64 = stringToBase64(message);
      const signature = uint8ArrayToBase64(signedMessage);

      const response = await fetch("/api/mint-history", {
        cache: "no-store",
        headers: {
          "x-admin-wallet": walletAddress,
          "x-admin-message-base64": messageBase64,
          "x-admin-signature": signature,
        },
      });

      const data: DashboardResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load dashboard.");
      }

      setHistory(data.history || []);
      setTotals(data.totals);
      setHasLoaded(true);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load dashboard."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
      <section className="mx-auto max-w-7xl">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="text-sm font-semibold text-amber-400">
            ← Back home
          </a>

          <div className="flex flex-wrap items-center gap-3">
            <a href="/mint" className="text-sm font-semibold text-emerald-400">
              Mint NFT →
            </a>

            <a href="/mynfts" className="text-sm font-semibold text-sky-400">
              My NFTs →
            </a>

            <WalletButton />
          </div>
        </nav>

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Admin
          </p>

          <h1 className="mt-3 text-5xl font-bold">Vertico Dashboard</h1>

          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            View verified mint records, payment totals, collection activity, and
            recent devnet mint history. Access requires the authorized admin
            wallet and a fresh wallet signature.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                Connected wallet
              </p>

              {connected && walletAddress ? (
                <p
                  className={`mt-2 break-all font-mono text-sm ${
                    isAdminWallet ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {walletAddress}
                </p>
              ) : (
                <p className="mt-2 text-sm text-red-300">
                  Connect the admin wallet to continue.
                </p>
              )}
            </div>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                isAdminWallet
                  ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                  : "border-red-400/40 bg-red-400/10 text-red-300"
              }`}
            >
              {isAdminWallet ? "Admin Wallet" : "Locked"}
            </span>
          </div>

          {!connected && (
            <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
              <p className="font-semibold text-amber-300">
                Wallet connection required
              </p>
              <p className="mt-2 text-sm leading-6 text-amber-100">
                Connect your admin Phantom wallet to access the dashboard.
              </p>
            </div>
          )}

          {connected && !isAdminWallet && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
              <p className="font-semibold text-red-300">Access denied</p>
              <p className="mt-2 text-sm leading-6 text-red-100">
                This wallet is not authorized to view the Vertico dashboard.
              </p>
            </div>
          )}

          {connected && isAdminWallet && (
            <div className="mt-6">
              <button
                onClick={loadDashboard}
                disabled={isLoading}
                className="rounded-xl bg-amber-500 px-6 py-3 font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading
                  ? "Verifying wallet..."
                  : hasLoaded
                    ? "Refresh Dashboard"
                    : "Sign Message & Load Dashboard"}
              </button>

              <p className="mt-3 text-sm text-zinc-400">
                Phantom will ask you to sign a message. This does not spend SOL
                and does not create a blockchain transaction.
              </p>
            </div>
          )}

          {loadError && (
            <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-400/10 p-5">
              <p className="font-semibold text-red-300">Dashboard error</p>
              <p className="mt-2 text-sm text-red-100">{loadError}</p>
            </div>
          )}
        </div>

        {hasLoaded && (
          <>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-zinc-400">Total Mints</p>
                <p className="mt-2 text-3xl font-bold">
                  {totals.totalMints}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-zinc-400">SOL Collected</p>
                <p className="mt-2 text-3xl font-bold">
                  {totals.totalSolCollected}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-zinc-400">Pages</p>
                <p className="mt-2 text-3xl font-bold">{totals.pages}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-zinc-400">Courtiers</p>
                <p className="mt-2 text-3xl font-bold">{totals.courtiers}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-zinc-400">Royals</p>
                <p className="mt-2 text-3xl font-bold">{totals.royals}</p>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-amber-400">
                    Recent Activity
                  </p>

                  <h2 className="mt-2 text-3xl font-bold">Recent Mints</h2>
                </div>

                <p className="text-sm text-zinc-400">
                  Showing latest {recentMints.length} records
                </p>
              </div>

              {recentMints.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6 text-zinc-400">
                  No mint records found yet.
                </div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[900px] border-separate border-spacing-y-3 text-left text-sm">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="px-4 py-2">Time</th>
                        <th className="px-4 py-2">NFT</th>
                        <th className="px-4 py-2">Collection</th>
                        <th className="px-4 py-2">Buyer</th>
                        <th className="px-4 py-2">Paid</th>
                        <th className="px-4 py-2">Links</th>
                      </tr>
                    </thead>

                    <tbody>
                      {recentMints.map((item) => (
                        <tr
                          key={item.id}
                          className="rounded-2xl bg-black/30 text-zinc-200"
                        >
                          <td className="rounded-l-2xl px-4 py-4">
                            {formatDate(item.timestamp)}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-semibold text-white">
                              {item.name}
                            </div>
                            <div className="mt-1 font-mono text-xs text-zinc-500">
                              {shortAddress(item.mintAddress)}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                              {collectionLabel(item.collection)}
                            </span>
                          </td>

                          <td className="px-4 py-4 font-mono text-xs">
                            {shortAddress(item.recipient)}
                          </td>

                          <td className="px-4 py-4">
                            {item.paymentAmountSol} SOL
                          </td>

                          <td className="rounded-r-2xl px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={item.explorer}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-emerald-400/40 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/10"
                              >
                                NFT
                              </a>

                              <a
                                href={item.paymentExplorer}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-sky-400/40 px-3 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-400/10"
                              >
                                Payment
                              </a>

                              <a
                                href={item.collectionExplorer}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-purple-400/40 px-3 py-1 text-xs font-semibold text-purple-300 hover:bg-purple-400/10"
                              >
                                Collection
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}