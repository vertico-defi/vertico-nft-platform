import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_WALLET = process.env.ADMIN_WALLET;
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

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

function decodeBase64(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

function getTimestampFromMessage(message: string) {
  const timestampLine = message
    .split("\n")
    .find((line) => line.startsWith("Timestamp:"));

  if (!timestampLine) {
    throw new Error("Admin auth message is missing timestamp.");
  }

  const timestamp = Number(timestampLine.replace("Timestamp:", "").trim());

  if (!Number.isFinite(timestamp)) {
    throw new Error("Admin auth message has invalid timestamp.");
  }

  return timestamp;
}

function verifyAdminSignature({
  wallet,
  messageBase64,
  signature,
}: {
  wallet: string | null;
  messageBase64: string | null;
  signature: string | null;
}) {
  if (!ADMIN_WALLET) {
    throw new Error("ADMIN_WALLET is not configured.");
  }

  if (!wallet || !messageBase64 || !signature) {
    return {
      ok: false,
      error: "Missing admin authentication headers.",
    };
  }

  let providedWallet: string;
  let expectedAdminWallet: string;

  try {
    providedWallet = new PublicKey(wallet).toBase58();
    expectedAdminWallet = new PublicKey(ADMIN_WALLET).toBase58();
  } catch {
    return {
      ok: false,
      error: "Invalid admin wallet address.",
    };
  }

  if (providedWallet !== expectedAdminWallet) {
    return {
      ok: false,
      error: "Unauthorized wallet.",
    };
  }

  let message: string;

  try {
    message = decodeBase64(messageBase64);
  } catch {
    return {
      ok: false,
      error: "Invalid admin auth message encoding.",
    };
  }

  if (!message.includes("Vertico Admin Dashboard Access")) {
    return {
      ok: false,
      error: "Invalid admin auth message.",
    };
  }

  if (!message.includes(`Wallet: ${providedWallet}`)) {
    return {
      ok: false,
      error: "Admin auth message wallet mismatch.",
    };
  }

  let timestamp: number;

  try {
    timestamp = getTimestampFromMessage(message);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Admin auth message timestamp error.",
    };
  }

  const messageAge = Date.now() - timestamp;

  if (messageAge < 0 || messageAge > MAX_MESSAGE_AGE_MS) {
    return {
      ok: false,
      error: "Admin auth message expired.",
    };
  }

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");
    const publicKeyBytes = new PublicKey(providedWallet).toBytes();

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValid) {
      return {
        ok: false,
        error: "Invalid admin wallet signature.",
      };
    }

    return {
      ok: true,
      error: null,
    };
  } catch {
    return {
      ok: false,
      error: "Could not verify admin wallet signature.",
    };
  }
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