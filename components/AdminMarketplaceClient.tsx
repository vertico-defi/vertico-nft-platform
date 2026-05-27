"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "@/components/WalletButton";

type CreatorProfile = {
  id: string;
  wallet_address: string;
  email: string;
  display_name: string;
  country: string;
  website_url: string | null;
  x_url: string | null;
  creator_status: string;
  identity_verification_status: string;
  created_at: string;
};

type CollectionSubmission = {
  id: string;
  collection_name: string;
  chain: string;
  collection_address: string | null;
  description: string;
  preview_image_urls: string[];
  metadata_sample_urls: string[];
  created_at: string;
  creator_profiles?: {
    display_name?: string;
    wallet_address?: string;
    email?: string;
  };
};

type MarketplaceCollection = {
  id: string;
  collection_name: string;
  chain: string;
  collection_address: string | null;
  description: string;
  status: string;
  created_at: string;
  creator_profiles?: {
    display_name?: string;
    wallet_address?: string;
  };
};

type NativeMarketplaceListing = {
  id: string;
  collection_type: "pages" | "courtiers" | "royals" | null;
  seller_wallet: string;
  mint_address: string | null;
  name: string;
  description: string;
  price_sol: number | null;
  sale_status: string;
  custody_status: string;
  created_at: string;
};

type ContentReport = {
  id: string;
  target_type: "collection" | "listing";
  target_id: string;
  reporter_wallet: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
};

type AuditLog = {
  id: string;
  actor_wallet: string | null;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AdminData = {
  pendingCreators: CreatorProfile[];
  pendingSubmissions: CollectionSubmission[];
  openReports: ContentReport[];
  approvedCollections: MarketplaceCollection[];
  nativeListings: NativeMarketplaceListing[];
  suspendedCollections: MarketplaceCollection[];
  suspendedListings: NativeMarketplaceListing[];
  auditLogs: AuditLog[];
};

type AdminAction =
  | "approve_creator"
  | "reject_creator"
  | "suspend_creator"
  | "approve_collection_submission"
  | "reject_collection_submission"
  | "suspend_marketplace_collection"
  | "hide_listing"
  | "suspend_listing"
  | "revalidate_listing_ownership"
  | "review_report"
  | "resolve_report"
  | "dismiss_report"
  | "suspend_report_target";

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
    "Sign this message to moderate the Vertico marketplace.",
  ].join("\n");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortAddress(value?: string | null) {
  if (!value) return "Unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export default function AdminMarketplaceClient() {
  const { publicKey, connected, signMessage } = useWallet();
  const [data, setData] = useState<AdminData>({
    pendingCreators: [],
    pendingSubmissions: [],
    openReports: [],
    approvedCollections: [],
    nativeListings: [],
    suspendedCollections: [],
    suspendedListings: [],
    auditLogs: [],
  });
  const [activeTab, setActiveTab] = useState<
    | "creators"
    | "submissions"
    | "collections"
    | "native"
    | "reports"
    | "audit"
  >("creators");
  const [auditFilter, setAuditFilter] = useState<
    "all" | "reports" | "listings" | "collections" | "creators"
  >("all");
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58();
  const isAdminWallet = walletAddress === ADMIN_WALLET;

  async function adminHeaders() {
    if (!walletAddress) throw new Error("Connect the admin wallet first.");
    if (!isAdminWallet) throw new Error("Connected wallet is not authorized.");
    if (!signMessage) throw new Error("This wallet does not support signing.");

    const messageToSign = createAdminMessage(walletAddress);
    const signedMessage = await signMessage(
      new TextEncoder().encode(messageToSign)
    );

    return {
      "x-admin-wallet": walletAddress,
      "x-admin-message-base64": stringToBase64(messageToSign),
      "x-admin-signature": uint8ArrayToBase64(signedMessage),
    };
  }

  async function loadAdminData() {
    setIsLoading(true);
    setMessage(null);

    try {
      const headers = await adminHeaders();
      const response = await fetch("/api/admin/marketplace", {
        cache: "no-store",
        headers,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load marketplace admin.");
      }

      setData({
        pendingCreators: result.pendingCreators || [],
        pendingSubmissions: result.pendingSubmissions || [],
        openReports: result.openReports || [],
        approvedCollections: result.approvedCollections || [],
        nativeListings: result.nativeListings || [],
        suspendedCollections: result.suspendedCollections || [],
        suspendedListings: result.suspendedListings || [],
        auditLogs: result.auditLogs || [],
      });
      setHasLoaded(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load marketplace admin."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(action: AdminAction, targetId: string) {
    const notes = window.prompt("Optional admin notes") || "";
    setIsLoading(true);
    setMessage(null);

    try {
      const headers = await adminHeaders();
      const response = await fetch("/api/admin/marketplace", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, targetId, notes }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Admin action failed.");
      }

      setMessage("Admin action completed.");
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function revalidateAllNativeListings() {
    setIsLoading(true);
    setMessage(null);

    try {
      const headers = await adminHeaders();
      const response = await fetch(
        "/api/admin/marketplace/revalidate-native-listings",
        {
          method: "POST",
          headers,
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Revalidation failed.");
      }

      setMessage(
        `Revalidated ${result.checked} native listing(s); suspended ${result.suspended}.`
      );
      await loadAdminData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revalidation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-white">
      <section className="mx-auto max-w-7xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm font-semibold text-amber-400">
            Back to dashboard
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/marketplace"
              className="rounded-xl border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10"
            >
              Marketplace
            </Link>
            <Link
              href="/admin/test-checklist"
              className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/10"
            >
              Test Checklist
            </Link>
            <Link
              href="/admin/diagnostics"
              className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400/10"
            >
              Diagnostics
            </Link>
            <WalletButton />
          </div>
        </nav>

        <header className="py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400">
            Admin moderation
          </p>
          <h1 className="mt-3 text-5xl font-bold">Marketplace Review</h1>
          <p className="mt-5 max-w-3xl leading-8 text-zinc-300">
            Approve creators, review adult collection submissions, suspend
            public collections, and resolve content reports. Every action
            requires the authorized admin wallet signature.
          </p>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                Connected wallet
              </p>
              <p
                className={`mt-2 break-all font-mono text-sm ${
                  isAdminWallet ? "text-emerald-300" : "text-red-300"
                }`}
              >
                {walletAddress || "Wallet connection required"}
              </p>
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

          {connected && isAdminWallet && (
            <button
              onClick={loadAdminData}
              disabled={isLoading}
              className="mt-6 rounded-xl bg-amber-500 px-6 py-3 font-bold text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Working..." : "Sign Message & Load Review Queue"}
            </button>
          )}

          {message && (
            <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              {message}
            </div>
          )}
        </div>

        {hasLoaded && (
          <>
            <div className="mt-8 flex flex-wrap gap-3">
              {[
                ["creators", `Pending creators (${data.pendingCreators.length})`],
                [
                  "submissions",
                  `Pending submissions (${data.pendingSubmissions.length})`,
                ],
                [
                  "collections",
                  `Approved collections (${data.approvedCollections.length})`,
                ],
                [
                  "native",
                  `Native listings (${data.nativeListings.length})`,
                ],
                ["reports", `Open reports (${data.openReports.length})`],
                ["audit", `Audit logs (${data.auditLogs.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() =>
                    setActiveTab(
                      id as
                        | "creators"
                        | "submissions"
                        | "collections"
                        | "native"
                        | "reports"
                        | "audit"
                    )
                  }
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                    activeTab === id
                      ? "border-amber-400 bg-amber-400 text-black"
                      : "border-white/15 text-zinc-200 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeTab === "creators" && (
              <div className="mt-6 grid gap-4">
                {data.pendingCreators.map((creator) => (
                  <section
                    key={creator.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold">
                          {creator.display_name}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          {creator.email} · {creator.country}
                        </p>
                        <p className="mt-2 break-all font-mono text-xs text-zinc-500">
                          {creator.wallet_address}
                        </p>
                        <p className="mt-3 text-sm text-zinc-300">
                          Identity status:{" "}
                          {creator.identity_verification_status}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          onClick={() => runAction("approve_creator", creator.id)}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => runAction("reject_creator", creator.id)}
                          className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/10"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => runAction("suspend_creator", creator.id)}
                          className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
                        >
                          Suspend
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
                {data.pendingCreators.length === 0 && (
                  <EmptyState label="No pending creators." />
                )}
              </div>
            )}

            {activeTab === "submissions" && (
              <div className="mt-6 grid gap-4">
                {data.pendingSubmissions.map((submission) => (
                  <section
                    key={submission.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="max-w-3xl">
                        <h2 className="text-2xl font-bold">
                          {submission.collection_name}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          {submission.chain} ·{" "}
                          {submission.creator_profiles?.display_name ||
                            shortAddress(
                              submission.creator_profiles?.wallet_address
                            )}
                        </p>
                        <p className="mt-3 leading-7 text-zinc-300">
                          {submission.description}
                        </p>
                        <p className="mt-3 text-xs text-zinc-500">
                          Submitted {formatDate(submission.created_at)}
                        </p>
                        <p className="mt-3 text-sm text-zinc-400">
                          Preview URLs: {submission.preview_image_urls?.length || 0}
                          {" · "}Metadata samples:{" "}
                          {submission.metadata_sample_urls?.length || 0}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          onClick={() =>
                            runAction(
                              "approve_collection_submission",
                              submission.id
                            )
                          }
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() =>
                            runAction(
                              "reject_collection_submission",
                              submission.id
                            )
                          }
                          className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/10"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
                {data.pendingSubmissions.length === 0 && (
                  <EmptyState label="No pending collection submissions." />
                )}
              </div>
            )}

            {activeTab === "collections" && (
              <div className="mt-6 grid gap-4">
                {data.approvedCollections.map((collection) => (
                  <section
                    key={collection.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="max-w-3xl">
                        <h2 className="text-2xl font-bold">
                          {collection.collection_name}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          {collection.chain} ·{" "}
                          {collection.creator_profiles?.display_name ||
                            shortAddress(
                              collection.creator_profiles?.wallet_address
                            )}
                        </p>
                        {collection.creator_profiles?.wallet_address && (
                          <Link
                            href={`/creators/${collection.creator_profiles.wallet_address}`}
                            className="mt-3 inline-flex rounded-xl border border-sky-400/40 px-3 py-2 text-xs font-bold text-sky-200 hover:bg-sky-400/10"
                          >
                            View Creator
                          </Link>
                        )}
                        <p className="mt-3 leading-7 text-zinc-300">
                          {collection.description}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          runAction("suspend_marketplace_collection", collection.id)
                        }
                        className="self-start rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
                      >
                        Suspend
                      </button>
                    </div>
                  </section>
                ))}
                {data.approvedCollections.length === 0 && (
                  <EmptyState label="No approved marketplace collections." />
                )}
                {data.suspendedCollections.length > 0 && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                    <h2 className="text-xl font-bold text-amber-100">
                      Suspended collections
                    </h2>
                    <div className="mt-4 grid gap-3">
                      {data.suspendedCollections.map((collection) => (
                        <p key={collection.id} className="text-sm text-amber-100">
                          {collection.collection_name} · {collection.chain}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "native" && (
              <div className="mt-6 grid gap-4">
                <div className="flex justify-end">
                  <button
                    onClick={revalidateAllNativeListings}
                    disabled={isLoading}
                    className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Revalidate All Ownership
                  </button>
                </div>
                {data.nativeListings.map((listing) => (
                  <section
                    key={listing.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="max-w-3xl">
                        <p className="text-sm font-semibold text-sky-300">
                          Native Vertico NFT
                        </p>
                        <h2 className="mt-2 text-2xl font-bold">
                          {listing.name}
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          Collection: {listing.collection_type || "vertico"} ·
                          Price:{" "}
                          {listing.price_sol === null
                            ? "pending"
                            : `${Number(listing.price_sol)} SOL`}{" "}
                          · Custody: {listing.custody_status}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300">
                            {listing.sale_status}
                          </span>
                          {listing.sale_status === "hidden" && (
                            <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                              Ownership Stale
                            </span>
                          )}
                        </div>
                        <p className="mt-3 break-all font-mono text-xs text-zinc-500">
                          Seller: {listing.seller_wallet}
                        </p>
                        {listing.mint_address && (
                          <p className="mt-2 break-all font-mono text-xs text-zinc-500">
                            Mint: {listing.mint_address}
                          </p>
                        )}
                        <p className="mt-3 leading-7 text-zinc-300">
                          {listing.description}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          onClick={() => runAction("hide_listing", listing.id)}
                          className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/10"
                        >
                          Hide Listing
                        </button>
                        <button
                          onClick={() =>
                            runAction("revalidate_listing_ownership", listing.id)
                          }
                          className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-400/10"
                        >
                          Revalidate Ownership
                        </button>
                        <Link
                          href={`/marketplace/listing/${listing.id}`}
                          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
                        >
                          View Detail
                        </Link>
                        <button
                          onClick={() =>
                            runAction("suspend_listing", listing.id)
                          }
                          className="rounded-xl border border-amber-400/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
                        >
                          Suspend Listing
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
                {data.nativeListings.length === 0 && (
                  <EmptyState label="No active native Vertico listings." />
                )}
                {data.suspendedListings.length > 0 && (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                    <h2 className="text-xl font-bold text-amber-100">
                      Suspended native listings
                    </h2>
                    <div className="mt-4 grid gap-3">
                      {data.suspendedListings.map((listing) => (
                        <p key={listing.id} className="text-sm text-amber-100">
                          {listing.name} · Suspended / Ownership Stale ·{" "}
                          {shortAddress(listing.seller_wallet)}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "reports" && (
              <div className="mt-6 grid gap-4">
                {data.openReports.map((report) => (
                  <section
                    key={report.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  >
                    <div className="flex flex-wrap justify-between gap-4">
                      <div className="max-w-3xl">
                        <h2 className="text-xl font-bold">
                          {report.target_type} report
                        </h2>
                        <p className="mt-2 text-sm text-zinc-400">
                          Target: {report.target_id}
                        </p>
                        <p className="mt-3 leading-7 text-zinc-200">
                          {report.reason}
                        </p>
                        {report.details && (
                          <p className="mt-2 leading-7 text-zinc-400">
                            {report.details}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-zinc-500">
                          Reporter: {shortAddress(report.reporter_wallet)} ·{" "}
                          {formatDate(report.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <button
                          onClick={() => runAction("review_report", report.id)}
                          className="rounded-xl border border-sky-400/40 px-4 py-2 text-sm font-bold text-sky-200 hover:bg-sky-400/10"
                        >
                          Mark Under Review
                        </button>
                        <button
                          onClick={() => runAction("resolve_report", report.id)}
                          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black hover:bg-emerald-400"
                        >
                          Resolve Report
                        </button>
                        <button
                          onClick={() => runAction("dismiss_report", report.id)}
                          className="rounded-xl border border-zinc-500 px-4 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10"
                        >
                          Dismiss Report
                        </button>
                        <button
                          onClick={() =>
                            runAction("suspend_report_target", report.id)
                          }
                          className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/10"
                        >
                          Suspend Target
                        </button>
                      </div>
                    </div>
                  </section>
                ))}
                {data.openReports.length === 0 && (
                  <EmptyState label="No open reports." />
                )}
              </div>
            )}

            {activeTab === "audit" && (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["reports", "Reports"],
                    ["listings", "Listings"],
                    ["collections", "Collections"],
                    ["creators", "Creators"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() =>
                        setAuditFilter(
                          id as
                            | "all"
                            | "reports"
                            | "listings"
                            | "collections"
                            | "creators"
                        )
                      }
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        auditFilter === id
                          ? "border-amber-400 bg-amber-400 text-black"
                          : "border-white/15 text-zinc-200 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3">
                  {data.auditLogs
                    .filter((log) => {
                      if (auditFilter === "all") return true;
                      if (auditFilter === "reports") {
                        return log.target_type === "content_report";
                      }
                      if (auditFilter === "listings") {
                        return log.target_type === "marketplace_listing";
                      }
                      if (auditFilter === "collections") {
                        return (
                          log.target_type === "marketplace_collection" ||
                          log.target_type === "collection_submission"
                        );
                      }
                      return log.target_type === "creator_profile";
                    })
                    .map((log) => (
                      <section
                        key={log.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-zinc-100">
                              {log.event_type}
                            </p>
                            <p className="mt-1 text-sm text-zinc-400">
                              {log.target_type || "unknown target"} ·{" "}
                              {log.target_id || "no target id"}
                            </p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {formatDate(log.created_at)}
                          </p>
                        </div>
                        <p className="mt-3 break-all font-mono text-xs text-zinc-500">
                          Actor: {log.actor_wallet || "system"}
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <p className="mt-3 line-clamp-3 break-all rounded-xl bg-black/30 p-3 font-mono text-xs text-zinc-400">
                            {JSON.stringify(log.metadata)}
                          </p>
                        )}
                      </section>
                    ))}
                  {data.auditLogs.length === 0 && (
                    <EmptyState label="No audit logs found." />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-zinc-400">
      {label}
    </div>
  );
}
