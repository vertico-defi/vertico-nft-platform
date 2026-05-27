import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NativeListingRow = {
  id: string;
  mint_address: string | null;
  sale_status: "listed" | "cancelled" | "hidden" | "sold";
  status: string;
  price_sol: number | null;
};

function normalizeWallet(value: string | null) {
  if (!value) return null;

  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const wallet = normalizeWallet(request.nextUrl.searchParams.get("wallet"));

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "A valid wallet query parameter is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("marketplace_listings")
      .select("id, mint_address, sale_status, status, price_sol")
      .eq("source", "vertico_native")
      .eq("seller_wallet", wallet)
      .eq("status", "approved")
      .eq("sale_status", "listed")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const listingsByMint: Record<
      string,
      {
        listingId: string;
        saleStatus: string;
        status: string;
        priceSol: number | null;
      }
    > = {};

    for (const listing of (data || []) as NativeListingRow[]) {
      if (!listing.mint_address || listingsByMint[listing.mint_address]) {
        continue;
      }

      listingsByMint[listing.mint_address] = {
        listingId: listing.id,
        saleStatus: listing.sale_status,
        status: listing.status,
        priceSol:
          listing.price_sol === null ? null : Number(listing.price_sol),
      };
    }

    return NextResponse.json({ success: true, listingsByMint });
  } catch (error) {
    console.error("Native listing state load failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Marketplace listing state is temporarily unavailable.",
      },
      { status: 500 }
    );
  }
}
