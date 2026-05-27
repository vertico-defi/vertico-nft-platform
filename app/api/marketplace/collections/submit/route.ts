import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWallet(walletAddress: unknown) {
  if (!requiredString(walletAddress)) return null;

  try {
    return new PublicKey(walletAddress as string).toBase58();
  } catch {
    return null;
  }
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = normalizeWallet(body.walletAddress);

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    const { data: creator, error: creatorError } = await supabaseAdmin
      .from("creator_profiles")
      .select("*")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (creatorError) throw new Error(creatorError.message);

    if (!creator || creator.creator_status !== "approved") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creator approval is required before submitting a collection for marketplace review.",
        },
        { status: 403 }
      );
    }

    if (
      !requiredString(body.collectionName) ||
      !requiredString(body.chain) ||
      !requiredString(body.description)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Collection name, chain, and description are required.",
        },
        { status: 400 }
      );
    }

    if (
      body.rightsAttestation !== true ||
      body.consentAttestation !== true ||
      body.adultPerformerAttestation !== true ||
      body.prohibitedContentAttestation !== true
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "All rights, consent, adult performer, and prohibited content attestations are required.",
        },
        { status: 400 }
      );
    }

    if (requiredString(body.collectionAddress)) {
      const { data: blockedCollection, error: blockedCollectionError } =
        await supabaseAdmin
          .from("blocked_collections")
          .select("collection_address")
          .eq("collection_address", body.collectionAddress.trim())
          .maybeSingle();

      if (blockedCollectionError) {
        throw new Error(blockedCollectionError.message);
      }

      if (blockedCollection) {
        return NextResponse.json(
          {
            success: false,
            error: "This collection cannot be submitted at this time.",
          },
          { status: 403 }
        );
      }
    }

    const { data, error } = await supabaseAdmin
      .from("collection_submissions")
      .insert({
        creator_id: creator.id,
        collection_name: body.collectionName.trim(),
        chain: body.chain.trim(),
        collection_address: requiredString(body.collectionAddress)
          ? body.collectionAddress.trim()
          : null,
        description: body.description.trim(),
        preview_image_urls: stringArray(body.previewImageUrls),
        metadata_sample_urls: stringArray(body.metadataSampleUrls),
        rights_attestation: true,
        consent_attestation: true,
        adult_performer_attestation: true,
        prohibited_content_attestation: true,
        status: "pending_review",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, submission: data });
  } catch (error) {
    console.error("Collection submission failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not submit collection right now.",
      },
      { status: 500 }
    );
  }
}
