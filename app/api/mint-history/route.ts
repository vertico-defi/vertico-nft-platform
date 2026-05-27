import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MintHistoryRow = {
  id: string;
  timestamp: string;
  network: "devnet";
  collection: "pages" | "courtiers" | "royals";
  name: string;
  description: string;
  attributes: {
    trait_type: string;
    value: string;
  }[];
  mint_address: string;
  recipient: string;
  payment_signature: string;
  payment_amount_sol: number;
  treasury_wallet: string;
  metadata_uri: string;
  image_uri: string;
  explorer: string;
  payment_explorer: string;
  collection_explorer: string;
};

function mapMintHistoryRow(row: MintHistoryRow) {
  return {
    id: row.id,
    timestamp: row.timestamp,
    network: row.network,
    collection: row.collection,
    name: row.name,
    description: row.description,
    attributes: row.attributes || [],
    mintAddress: row.mint_address,
    recipient: row.recipient,
    paymentSignature: row.payment_signature,
    paymentAmountSol: Number(row.payment_amount_sol),
    treasuryWallet: row.treasury_wallet,
    metadataUri: row.metadata_uri,
    imageUri: row.image_uri,
    explorer: row.explorer,
    paymentExplorer: row.payment_explorer,
    collectionExplorer: row.collection_explorer,
  };
}

export async function GET(request: NextRequest) {
  try {
    const wallet = request.headers.get("x-admin-wallet");
    const messageBase64 = request.headers.get("x-admin-message-base64");
    const signature = request.headers.get("x-admin-signature");

    const auth = verifyAdminSignature({
      wallet,
      messageBase64,
      signature,
    });

    if (!auth.ok) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error || "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("mint_history")
      .select("*")
      .order("timestamp", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const history = ((data || []) as MintHistoryRow[]).map(mapMintHistoryRow);

    const totals = history.reduce(
      (
        acc: {
          totalMints: number;
          totalSolCollected: number;
          pages: number;
          courtiers: number;
          royals: number;
        },
        item
      ) => {
        acc.totalMints += 1;
        acc.totalSolCollected += Number(item.paymentAmountSol || 0);

        if (item.collection === "pages") acc.pages += 1;
        if (item.collection === "courtiers") acc.courtiers += 1;
        if (item.collection === "royals") acc.royals += 1;

        return acc;
      },
      {
        totalMints: 0,
        totalSolCollected: 0,
        pages: 0,
        courtiers: 0,
        royals: 0,
      }
    );

    return NextResponse.json({
      success: true,
      history,
      totals: {
        ...totals,
        totalSolCollected: Number(totals.totalSolCollected.toFixed(4)),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load mint history.",
      },
      { status: 500 }
    );
  }
}
