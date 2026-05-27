import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyVerticoNativeNftOwnership } from "@/lib/verticoNativeNft";
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

function normalizeMint(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}

function normalizePrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const walletAddress = normalizeWallet(body.walletAddress);
    const mintAddress = normalizeMint(body.mintAddress);
    const priceSol = normalizePrice(body.priceSol);

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: "A valid wallet address is required." },
        { status: 400 }
      );
    }

    if (!mintAddress) {
      return NextResponse.json(
        { success: false, error: "A valid mint address is required." },
        { status: 400 }
      );
    }

    if (priceSol === null) {
      return NextResponse.json(
        { success: false, error: "Price in SOL must be positive." },
        { status: 400 }
      );
    }

    const auth = verifyWalletSignature({
      wallet: walletAddress,
      messageBase64: request.headers.get("x-wallet-message-base64"),
      signature: request.headers.get("x-wallet-signature"),
      requiredLines: [
        "Action: create_native_listing",
        `Mint: ${mintAddress}`,
        `Price SOL: ${priceSol}`,
      ],
    });

    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized wallet action." },
        { status: 401 }
      );
    }

    const { data: existingListing, error: existingError } = await supabaseAdmin
      .from("marketplace_listings")
      .select("id")
      .eq("mint_address", mintAddress)
      .eq("sale_status", "listed")
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existingListing) {
      return NextResponse.json(
        { success: false, error: "This NFT already has an active listing." },
        { status: 409 }
      );
    }

    const verifiedNft = await verifyVerticoNativeNftOwnership({
      walletAddress,
      mintAddress,
    });

    const { data, error } = await supabaseAdmin
      .from("marketplace_listings")
      .insert({
        source: "vertico_native",
        collection_type: verifiedNft.collectionType,
        seller_wallet: verifiedNft.walletAddress,
        owner_wallet: verifiedNft.walletAddress,
        mint_address: verifiedNft.mintAddress,
        name: verifiedNft.name,
        description: verifiedNft.description,
        image_url: verifiedNft.imageUrl,
        metadata_uri: verifiedNft.metadataUri,
        attributes: verifiedNft.attributes,
        price_sol: priceSol,
        status: "approved",
        sale_status: "listed",
        custody_status: "wallet_held",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, listing: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create native marketplace listing.",
      },
      { status: 500 }
    );
  }
}
