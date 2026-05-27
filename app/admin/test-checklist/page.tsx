"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

const ADMIN_WALLET = "znwtFnSfXnaCDfkpTUwaE5eKFa9ENTa763LV88cqJSN";

const sections = [
  {
    title: "Schema / Environment",
    items: [
      "Run updated Supabase SQL",
      "Confirm creator_profiles.bio column exists",
      "Open /admin/diagnostics",
      "Confirm all diagnostics are OK or expected warnings",
    ],
  },
  {
    title: "Creator Profiles",
    items: [
      "Open /creators/[approved-wallet]",
      "Open /creators/[non-approved-wallet]",
      "Confirm non-approved creator profile is not exposed",
    ],
  },
  {
    title: "Public Policy Pages",
    items: [
      "Open /safety",
      "Open /marketplace/how-it-works",
      "Open /marketplace/rules",
    ],
  },
  {
    title: "Native Listing Detail Pages",
    items: [
      "Open /marketplace/listing/[id]",
      "Confirm Buy Coming Soon is disabled",
      "Submit a report from detail page",
    ],
  },
  {
    title: "External Collection Detail Pages",
    items: [
      "Open /marketplace/collection/[id]",
      "Open linked creator profile",
      "Submit a report from detail page",
    ],
  },
  {
    title: "Diagnostics",
    items: [
      "Open /admin/diagnostics",
      "Open /admin/routes",
      "Confirm report appears in admin after submission",
    ],
  },
  {
    title: "Minting",
    items: ["Mint a Page NFT", "Mint a Courtier NFT", "Mint a Royal NFT"],
  },
  {
    title: "My NFTs",
    items: [
      "Confirm each minted NFT appears in My NFTs",
      "Refresh wallet ownership",
      "Confirm transferred-away NFTs do not appear",
    ],
  },
  {
    title: "Native Listings",
    items: [
      "List one NFT on marketplace",
      "Open listing detail page",
      "Cancel listing",
      "Confirm Buy Coming Soon stays disabled",
    ],
  },
  {
    title: "Marketplace Browse",
    items: [
      "Search listings",
      "Use Native Vertico NFT filter",
      "Use External Collections filter",
      "Sort by price and name",
    ],
  },
  {
    title: "Reports",
    items: [
      "Submit report from marketplace card",
      "Submit report from detail page",
      "Confirm reporter data is not public",
    ],
  },
  {
    title: "Admin Moderation",
    items: [
      "Load admin marketplace with signature",
      "Mark report under review",
      "Resolve report as admin",
      "Dismiss report as admin",
      "Suspend target from report",
    ],
  },
  {
    title: "Creator Applications",
    items: ["Apply as creator", "Approve creator", "Reject test creator"],
  },
  {
    title: "Collection Submissions",
    items: [
      "Submit external collection",
      "Approve external collection",
      "Confirm public marketplace visibility",
    ],
  },
  {
    title: "External Collection Approval",
    items: [
      "Open collection detail page",
      "Open creator profile page",
      "Confirm rejected submissions are not public",
    ],
  },
  {
    title: "Ownership Revalidation",
    items: [
      "Run Revalidate All Ownership",
      "Revalidate one listing",
      "Confirm stale listing appears suspended in admin only",
    ],
  },
  {
    title: "Navigation",
    items: [
      "Marketplace links to My NFTs and Mint",
      "Mint success links to My NFTs and Marketplace",
      "Footer links load",
    ],
  },
  {
    title: "Safety/Rules Pages",
    items: [
      "/safety loads",
      "/marketplace/how-it-works loads",
      "/marketplace/rules loads",
    ],
  },
];

export default function AdminTestChecklistPage() {
  const { publicKey, signMessage } = useWallet();
  const [signed, setSigned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const walletAddress = publicKey?.toBase58();
  const isAdminWallet = walletAddress === ADMIN_WALLET;

  async function unlockChecklist() {
    setMessage(null);

    if (!walletAddress || !isAdminWallet || !signMessage) {
      setMessage("Connect the admin wallet to view the checklist.");
      return;
    }

    const text = [
      "Vertico Admin Test Checklist",
      `Wallet: ${walletAddress}`,
      `Timestamp: ${Date.now()}`,
      "",
      "Sign this message to view the private launch checklist.",
    ].join("\n");

    await signMessage(new TextEncoder().encode(text));
    setSigned(true);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <Link href="/admin/marketplace" className="text-amber-400">
              Marketplace Admin
            </Link>
            <Link href="/admin/diagnostics" className="text-sky-300">
              Diagnostics
            </Link>
            <Link href="/admin/routes" className="text-zinc-300">
              Routes
            </Link>
          </div>
          <WalletButton />
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Admin QA
          </p>
          <h1 className="mt-3 text-5xl font-bold">Public Test Checklist</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Private manual QA checklist for Vertico devnet launch readiness.
          </p>
        </header>

        {!signed && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="break-all font-mono text-sm text-zinc-300">
              {walletAddress || "Admin wallet connection required"}
            </p>
            <button
              onClick={unlockChecklist}
              disabled={!isAdminWallet}
              className="mt-5 rounded-xl bg-amber-500 px-5 py-3 font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign & View Checklist
            </button>
            {message && (
              <p className="mt-4 text-sm text-amber-100">{message}</p>
            )}
          </div>
        )}

        {signed && (
          <div className="grid gap-5 md:grid-cols-2">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h2 className="text-2xl font-bold">{section.title}</h2>
                <div className="mt-4 space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-zinc-200"
                    >
                      [ ] {item}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
