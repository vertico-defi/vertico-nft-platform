import { NextResponse } from "next/server";
import { revalidateNativeListingOwnership } from "@/lib/nativeListingRevalidation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MarketplaceCollectionRow = {
  id: string;
  submission_id: string;
  creator_id: string;
  collection_name: string;
  chain: string;
  collection_address: string | null;
  description: string;
  preview_image_urls: string[];
  status: "approved" | "suspended";
  created_at: string;
  updated_at: string;
};

type MarketplaceListingRow = {
  id: string;
  marketplace_collection_id: string | null;
  source: "external" | "vertico_native";
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

type CreatorProfileRow = {
  id: string;
  display_name: string;
  wallet_address: string;
};

export async function GET() {
  try {
    const { data: collectionsData, error: collectionsError } =
      await supabaseAdmin
        .from("marketplace_collections")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });

    if (collectionsError) throw new Error(collectionsError.message);

    const collections = (collectionsData || []) as MarketplaceCollectionRow[];
    const collectionIds = collections.map((collection) => collection.id);
    const creatorIds = collections.map((collection) => collection.creator_id);

    const { data: listingsData, error: listingsError } = collectionIds.length
      ? await supabaseAdmin
          .from("marketplace_listings")
          .select("*")
          .in("marketplace_collection_id", collectionIds)
          .eq("source", "external")
          .eq("status", "approved")
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (listingsError) throw new Error(listingsError.message);

    const { data: nativeListingsData, error: nativeListingsError } =
      await supabaseAdmin
        .from("marketplace_listings")
        .select("*")
        .eq("source", "vertico_native")
        .eq("status", "approved")
        .eq("sale_status", "listed")
        .order("created_at", { ascending: false });

    if (nativeListingsError) throw new Error(nativeListingsError.message);

    const { data: creatorsData, error: creatorsError } = creatorIds.length
      ? await supabaseAdmin
          .from("creator_profiles")
          .select("id, display_name, wallet_address")
          .in("id", creatorIds)
      : { data: [], error: null };

    if (creatorsError) throw new Error(creatorsError.message);

    const listings = (listingsData || []) as MarketplaceListingRow[];
    const nativeListings = (nativeListingsData || []) as MarketplaceListingRow[];
    const currentNativeListings: MarketplaceListingRow[] = [];

    for (const listing of nativeListings) {
      const result = await revalidateNativeListingOwnership({
        listing: {
          id: listing.id,
          seller_wallet: listing.seller_wallet,
          mint_address: listing.mint_address,
          collection_type: listing.collection_type,
        },
      });

      if (result.isCurrentOwner) {
        currentNativeListings.push(listing);
      }
    }
    const creators = (creatorsData || []) as CreatorProfileRow[];

    const creatorById = new Map(
      creators.map((creator) => [creator.id, creator])
    );

    const listingsByCollectionId = new Map<string, MarketplaceListingRow[]>();

    for (const listing of listings) {
      if (!listing.marketplace_collection_id) continue;

      const group = listingsByCollectionId.get(listing.marketplace_collection_id);

      if (group) {
        group.push(listing);
      } else {
        listingsByCollectionId.set(listing.marketplace_collection_id, [
          listing,
        ]);
      }
    }

    return NextResponse.json({
      success: true,
      nativeListings: currentNativeListings.map((listing) => ({
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
        createdAt: listing.created_at,
        updatedAt: listing.updated_at,
      })),
      collections: collections.map((collection) => ({
        id: collection.id,
        submissionId: collection.submission_id,
        creatorId: collection.creator_id,
        creator: creatorById.get(collection.creator_id) || null,
        collectionName: collection.collection_name,
        chain: collection.chain,
        collectionAddress: collection.collection_address,
        description: collection.description,
        previewImageUrls: Array.isArray(collection.preview_image_urls)
          ? collection.preview_image_urls
          : [],
        status: collection.status,
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
        listings: (listingsByCollectionId.get(collection.id) || []).map(
          (listing) => ({
            id: listing.id,
            marketplaceCollectionId: listing.marketplace_collection_id,
            sellerWallet: listing.seller_wallet,
            mintAddress: listing.mint_address,
            name: listing.name,
            description: listing.description,
            imageUrl: listing.image_url,
            priceSol:
              listing.price_sol === null ? null : Number(listing.price_sol),
            status: listing.status,
            createdAt: listing.created_at,
            updatedAt: listing.updated_at,
          })
        ),
      })),
    });
  } catch (error) {
    console.error("Approved marketplace load failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Marketplace data is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
