"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

type DiagnosticStatus = "ok" | "warning" | "error";

type DiagnosticCheck = {
  name: string;
  status: DiagnosticStatus;
  message: string;
};

const ADMIN_WALLET = "znwtFnSfXnaCDfkpTUwaE5eKFa9ENTa763LV88cqJSN";

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
    "Sign this message to run Vertico diagnostics.",
  ].join("\n");
}

function statusClasses(status: DiagnosticStatus) {
  if (status === "ok") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  if (status === "warning") return "border-amber-400/40 bg-amber-400/10 text-amber-200";
  return "border-red-400/40 bg-red-400/10 text-red-200";
}

function groupName(name: string) {
  if (name.startsWith("Schema:")) return "Marketplace Schema";
  if (name.includes("Supabase")) return "Supabase";
  if (name.includes("Solana") || name.includes("Treasury")) {
    return "Solana Config";
  }
  if (name.includes("collection state") || name.includes("Image URI")) {
    return "Collection Files";
  }
  return "Environment Variables";
}

export default function AdminDiagnosticsClient() {
  const { publicKey, signMessage } = useWallet();
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = publicKey?.toBase58();
  const isAdminWallet = walletAddress === ADMIN_WALLET;

  const groupedChecks = useMemo(() => {
    return checks.reduce<Record<string, DiagnosticCheck[]>>((groups, check) => {
      const key = groupName(check.name);
      groups[key] = groups[key] || [];
      groups[key].push(check);
      return groups;
    }, {});
  }, [checks]);

  async function loadDiagnostics() {
    setMessage(null);

    if (!walletAddress || !isAdminWallet || !signMessage) {
      setMessage("Connect the admin wallet to run diagnostics.");
      return;
    }

    setIsLoading(true);

    try {
      const messageToSign = createAdminMessage(walletAddress);
      const signature = await signMessage(
        new TextEncoder().encode(messageToSign)
      );
      const response = await fetch("/api/admin/diagnostics", {
        cache: "no-store",
        headers: {
          "x-admin-wallet": walletAddress,
          "x-admin-message-base64": stringToBase64(messageToSign),
          "x-admin-signature": uint8ArrayToBase64(signature),
        },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not run diagnostics.");
      }

      setChecks(data.checks || []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not run diagnostics."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin/marketplace" className="text-amber-400">
              Marketplace Admin
            </Link>
            <Link href="/admin/test-checklist" className="text-sky-300">
              Test Checklist
            </Link>
            <Link href="/admin/routes" className="text-zinc-300">
              Routes
            </Link>
          </div>
          <WalletButton />
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Admin diagnostics
          </p>
          <h1 className="mt-3 text-5xl font-bold">System Diagnostics</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            This page is for development/admin testing only. It does not expose
            secrets.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="break-all font-mono text-sm text-zinc-300">
            {walletAddress || "Admin wallet connection required"}
          </p>
          <button
            onClick={loadDiagnostics}
            disabled={!isAdminWallet || isLoading}
            className="mt-5 rounded-xl bg-amber-500 px-5 py-3 font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Running..." : "Sign & Run Diagnostics"}
          </button>
          {message && <p className="mt-4 text-sm text-amber-100">{message}</p>}
        </div>

        {checks.length === 0 && !isLoading && (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-400">
            Run diagnostics to check Supabase, marketplace schema, Solana
            config, collection files, and environment variables.
          </div>
        )}

        <div className="mt-8 grid gap-5">
          {Object.entries(groupedChecks).map(([group, groupChecks]) => (
            <section
              key={group}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <h2 className="text-2xl font-bold">{group}</h2>
              <div className="mt-4 grid gap-3">
                {groupChecks.map((check) => (
                  <div
                    key={check.name}
                    className="rounded-xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold text-zinc-100">{check.name}</p>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold uppercase ${statusClasses(check.status)}`}
                      >
                        {check.status === "ok"
                          ? "OK"
                          : check.status === "warning"
                            ? "Warning"
                            : "Error"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {check.message}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
