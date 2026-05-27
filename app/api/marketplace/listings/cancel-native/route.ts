import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyWalletSignature } from "@/lib/walletSignatureAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeWallet(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = normalizeWallet(body.walletAddress);

    if (!walletAddress || typeof body.listingId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "A valid wallet address and listingId are required.",
        },
        { status: 400 }
      );
    }

    const { data: listing, error: listingError } = await supabaseAdmin
      .from("marketplace_listings")
      .select("*")
      .eq("id", body.listingId)
      .single();

    if (listingError) throw new Error(listingError.message);

    if (listing.source !== "vertico_native") {
      return NextResponse.json(
        { success: false, error: "Only Vertico-native listings can be cancelled here." },
        { status: 400 }
      );
    }

    if (listing.seller_wallet !== walletAddress) {
      return NextResponse.json(
        { success: false, error: "Only the seller wallet can cancel this listing." },
        { status: 403 }
      );
    }

    if (listing.sale_status !== "listed") {
      return NextResponse.json(
        { success: false, error: "Only active listed NFTs can be cancelled." },
        { status: 400 }
      );
    }

    const auth = verifyWalletSignature({
      wallet: walletAddress,
      messageBase64: request.headers.get("x-wallet-message-base64"),
      signature: request.headers.get("x-wallet-signature"),
      requiredLines: [
        "Action: cancel_native_listing",
        `Listing: ${body.listingId}`,
      ],
    });

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized wallet action." },
        { status: 401 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("marketplace_listings")
      .update({ sale_status: "cancelled", status: "suspended" })
      .eq("id", body.listingId);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Native listing cancellation failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not cancel marketplace listing right now.",
      },
      { status: 500 }
    );
  }
}
