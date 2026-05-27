import { NextRequest, NextResponse } from "next/server";
import { revalidateNativeListingOwnership } from "@/lib/nativeListingRevalidation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NativeListingRow = {
  id: string;
  source: "vertico_native";
  collection_type: "pages" | "courtiers" | "royals" | null;
  owner_wallet: string | null;
  seller_wallet: string;
  mint_address: string | null;
  metadata_uri: string | null;
  name: string;
  description: string;
  image_url: string | null;
  attributes: unknown[];
  price_sol: number | null;
  status: string;
  sale_status: string;
  custody_status: string;
  created_at: string;
  updated_at: string;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("marketplace_listings")
      .select(
        "id, source, collection_type, owner_wallet, seller_wallet, mint_address, metadata_uri, name, description, image_url, attributes, price_sol, status, sale_status, custody_status, created_at, updated_at"
      )
      .eq("id", id)
      .eq("source", "vertico_native")
      .eq("status", "approved")
      .eq("sale_status", "listed")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Listing was not found." },
        { status: 404 }
      );
    }

    const listing = data as NativeListingRow;
    const ownership = await revalidateNativeListingOwnership({
      listing: {
        id: listing.id,
        seller_wallet: listing.seller_wallet,
        mint_address: listing.mint_address,
        collection_type: listing.collection_type,
      },
    });

    if (!ownership.isCurrentOwner) {
      return NextResponse.json(
        { success: false, error: "Listing is no longer public." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      listing: {
        id: listing.id,
        source: listing.source,
        collectionType: listing.collection_type,
        sellerWallet: listing.seller_wallet,
        ownerWallet: listing.owner_wallet,
        mintAddress: listing.mint_address,
        metadataUri: listing.metadata_uri,
        name: listing.name,
        description: listing.description,
        imageUrl: listing.image_url,
        attributes: Array.isArray(listing.attributes) ? listing.attributes : [],
        priceSol: listing.price_sol === null ? null : Number(listing.price_sol),
        status: listing.status,
        saleStatus: listing.sale_status,
        custodyStatus: listing.custody_status,
        ownershipStatus: "current",
        createdAt: listing.created_at,
        updatedAt: listing.updated_at,
      },
    });
  } catch (error) {
    console.error("Marketplace listing detail failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "This listing is not available.",
      },
      { status: 500 }
    );
  }
}
