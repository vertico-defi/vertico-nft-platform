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

    if (
      !requiredString(body.email) ||
      !requiredString(body.displayName) ||
      !requiredString(body.country)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Email, display name, and country are required.",
        },
        { status: 400 }
      );
    }

    if (body.ageAttested !== true || body.rightsAttested !== true) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must confirm that you are 18+ and own or control the submitted rights.",
        },
        { status: 400 }
      );
    }

    const { data: blockedWallet, error: blockedError } = await supabaseAdmin
      .from("blocked_wallets")
      .select("wallet_address")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (blockedError) throw new Error(blockedError.message);

    if (blockedWallet) {
      return NextResponse.json(
        { success: false, error: "This wallet cannot apply at this time." },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("creator_profiles")
      .upsert(
        {
          wallet_address: walletAddress,
          email: body.email.trim(),
          display_name: body.displayName.trim(),
          bio: requiredString(body.bio) ? body.bio.trim() : null,
          country: body.country.trim(),
          website_url: requiredString(body.websiteUrl)
            ? body.websiteUrl.trim()
            : null,
          x_url: requiredString(body.xUrl) ? body.xUrl.trim() : null,
          age_attested: true,
          rights_attested: true,
        },
        { onConflict: "wallet_address" }
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, creator: data });
  } catch (error) {
    console.error("Creator application submission failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not submit creator application right now.",
      },
      { status: 500 }
    );
  }
}
