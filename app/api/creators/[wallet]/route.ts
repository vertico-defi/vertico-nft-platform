import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreatorRow = {
  id: string;
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  website_url: string | null;
  x_url: string | null;
  creator_status: "approved";
};

type CollectionRow = {
  id: string;
  collection_name: string;
  description: string;
  chain: string;
  preview_image_urls: string[];
  collection_address: string | null;
};

function normalizeWallet(value: string) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const walletAddress = normalizeWallet(wallet);

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "Creator profile is not publicly available." },
        { status: 404 }
      );
    }

    let creatorResponse = await supabaseAdmin
      .from("creator_profiles")
      .select("id, wallet_address, display_name, bio, website_url, x_url, creator_status")
      .eq("wallet_address", walletAddress)
      .eq("creator_status", "approved")
      .maybeSingle();

    if (
      creatorResponse.error &&
      creatorResponse.error.message.toLowerCase().includes("bio")
    ) {
      console.warn("creator_profiles.bio is missing; falling back without bio.");
      creatorResponse = await supabaseAdmin
        .from("creator_profiles")
        .select("id, wallet_address, display_name, website_url, x_url, creator_status")
        .eq("wallet_address", walletAddress)
        .eq("creator_status", "approved")
        .maybeSingle();
    }

    const { data: creatorData, error: creatorError } = creatorResponse;

    if (creatorError) throw new Error(creatorError.message);

    if (!creatorData) {
      return NextResponse.json(
        { success: false, error: "Creator profile is not publicly available." },
        { status: 404 }
      );
    }

    const creator = {
      bio: null,
      ...(creatorData as Omit<CreatorRow, "bio"> & { bio?: string | null }),
    } as CreatorRow;
    const { data: collectionsData, error: collectionsError } =
      await supabaseAdmin
        .from("marketplace_collections")
        .select(
          "id, collection_name, description, chain, preview_image_urls, collection_address"
        )
        .eq("creator_id", creator.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

    if (collectionsError) throw new Error(collectionsError.message);

    const collections = (collectionsData || []) as CollectionRow[];

    return NextResponse.json({
      success: true,
      creator: {
        walletAddress: creator.wallet_address,
        displayName: creator.display_name,
        bio: creator.bio,
        websiteUrl: creator.website_url,
        xUrl: creator.x_url,
        status: "approved",
      },
      collections: collections.map((collection) => ({
        id: collection.id,
        name: collection.collection_name,
        description: collection.description,
        chain: collection.chain,
        imageUrl: Array.isArray(collection.preview_image_urls)
          ? collection.preview_image_urls[0] || null
          : null,
        collectionAddress: collection.collection_address,
      })),
    });
  } catch (error) {
    console.error("Creator profile load failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Creator profile is not publicly available.",
      },
      { status: 500 }
    );
  }
}
