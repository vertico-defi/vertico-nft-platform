import { NextRequest, NextResponse } from "next/server";
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
  status: "approved";
  created_at: string;
  updated_at: string;
  creator_profiles?: {
    display_name?: string | null;
    wallet_address?: string | null;
  } | null;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from("marketplace_collections")
      .select(
        "id, submission_id, creator_id, collection_name, chain, collection_address, description, preview_image_urls, status, created_at, updated_at, creator_profiles(display_name, wallet_address)"
      )
      .eq("id", id)
      .eq("status", "approved")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Collection was not found." },
        { status: 404 }
      );
    }

    const collection = data as MarketplaceCollectionRow;

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        submissionId: collection.submission_id,
        creatorId: collection.creator_id,
        creator: collection.creator_profiles || null,
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
      },
    });
  } catch (error) {
    console.error("Marketplace collection detail failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "This collection is not available.",
      },
      { status: 500 }
    );
  }
}
