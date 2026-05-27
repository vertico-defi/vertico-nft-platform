import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyVerticoNativeNftOwnership } from "@/lib/verticoNativeNft";

export type NativeListingForRevalidation = {
  id: string;
  seller_wallet: string | null;
  mint_address: string | null;
  collection_type: "pages" | "courtiers" | "royals" | null;
};

export type NativeListingRevalidationResult = {
  listingId: string;
  isCurrentOwner: boolean;
  reason: string | null;
};

const STALE_REASON = "Seller no longer owns listed NFT";

export async function suspendStaleNativeListing({
  listing,
  actorWallet,
  reason = STALE_REASON,
}: {
  listing: NativeListingForRevalidation;
  actorWallet?: string | null;
  reason?: string;
}) {
  const { error: updateError } = await supabaseAdmin
    .from("marketplace_listings")
    .update({
      status: "suspended",
      sale_status: "hidden",
    })
    .eq("id", listing.id);

  if (updateError) throw new Error(updateError.message);

  const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
    actor_wallet: actorWallet || null,
    event_type: "native_listing_ownership_revalidation_failed",
    target_type: "marketplace_listing",
    target_id: listing.id,
    metadata: {
      reason,
      sellerWallet: listing.seller_wallet,
      mintAddress: listing.mint_address,
      nextStatus: "suspended",
      nextSaleStatus: "hidden",
    },
  });

  if (auditError) throw new Error(auditError.message);
}

export async function revalidateNativeListingOwnership({
  listing,
  actorWallet,
  writeReview = false,
}: {
  listing: NativeListingForRevalidation;
  actorWallet?: string | null;
  writeReview?: boolean;
}): Promise<NativeListingRevalidationResult> {
  let staleReason: string | null = null;

  if (!listing.seller_wallet || !listing.mint_address) {
    staleReason = STALE_REASON;
  } else {
    try {
      const verified = await verifyVerticoNativeNftOwnership({
        walletAddress: listing.seller_wallet,
        mintAddress: listing.mint_address,
      });

      if (
        verified.mintAddress !== listing.mint_address ||
        verified.walletAddress !== listing.seller_wallet ||
        verified.collectionType !== listing.collection_type
      ) {
        staleReason = STALE_REASON;
      }
    } catch {
      staleReason = STALE_REASON;
    }
  }

  if (!staleReason) {
    return {
      listingId: listing.id,
      isCurrentOwner: true,
      reason: null,
    };
  }

  await suspendStaleNativeListing({
    listing,
    actorWallet,
    reason: staleReason,
  });

  if (writeReview && actorWallet) {
    const { error } = await supabaseAdmin.from("moderation_reviews").insert({
      admin_wallet: actorWallet,
      target_type: "marketplace_listing",
      target_id: listing.id,
      decision: "revalidate_native_listing_failed",
      notes: staleReason,
    });

    if (error) throw new Error(error.message);
  }

  return {
    listingId: listing.id,
    isCurrentOwner: false,
    reason: staleReason,
  };
}

export async function revalidateActiveNativeListings({
  actorWallet,
  writeReview = false,
}: {
  actorWallet?: string | null;
  writeReview?: boolean;
} = {}) {
  const { data, error } = await supabaseAdmin
    .from("marketplace_listings")
    .select("id, seller_wallet, mint_address, collection_type")
    .eq("source", "vertico_native")
    .eq("status", "approved")
    .eq("sale_status", "listed");

  if (error) throw new Error(error.message);

  const results: NativeListingRevalidationResult[] = [];

  for (const listing of (data || []) as NativeListingForRevalidation[]) {
    results.push(
      await revalidateNativeListingOwnership({
        listing,
        actorWallet,
        writeReview,
      })
    );
  }

  return results;
}
