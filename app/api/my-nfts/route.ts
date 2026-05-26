import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CollectionType = "pages" | "courtiers" | "royals";

type MintAttribute = {
  trait_type: string;
  value: string;
};

type ParsedMetadata = {
  name: string;
  symbol: string;
  uri: string;
  collection?: {
    verified: boolean;
    key: string;
  };
};

type SupabaseMintHistoryRow = {
  id: string;
  timestamp: string;
  network: "devnet";
  collection: CollectionType;
  name: string;
  description: string;
  attributes: MintAttribute[];
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

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const PROJECT_ROOT = process.cwd();

const COLLECTION_STATE_PATHS: Record<CollectionType, string[]> = {
  pages: [
    path.join(PROJECT_ROOT, "data", "pages-collection-devnet.json"),
    path.join(PROJECT_ROOT, "..", "data", "pages-collection-devnet.json"),
  ],
  courtiers: [
    path.join(PROJECT_ROOT, "data", "courtiers-collection-devnet.json"),
    path.join(PROJECT_ROOT, "..", "data", "courtiers-collection-devnet.json"),
  ],
  royals: [
    path.join(PROJECT_ROOT, "data", "royals-collection-devnet.json"),
    path.join(PROJECT_ROOT, "..", "data", "royals-collection-devnet.json"),
  ],
};

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadCollectionMints() {
  const collections: {
    collection: CollectionType;
    mint: string;
    explorer: string;
  }[] = [];

  for (const collection of Object.keys(
    COLLECTION_STATE_PATHS
  ) as CollectionType[]) {
    for (const statePath of COLLECTION_STATE_PATHS[collection]) {
      if (!fs.existsSync(statePath)) {
        continue;
      }

      const state = loadJson(statePath);

      if (state.collectionMint) {
        collections.push({
          collection,
          mint: String(state.collectionMint),
          explorer:
            state.explorer ||
            `https://explorer.solana.com/address/${state.collectionMint}?cluster=devnet`,
        });

        break;
      }
    }
  }

  return collections;
}

function readBorshString(buffer: Buffer, offset: number) {
  const length = buffer.readUInt32LE(offset);
  offset += 4;

  const value = buffer
    .subarray(offset, offset + length)
    .toString("utf8")
    .replace(/\0/g, "")
    .trim();

  offset += length;

  return {
    value,
    offset,
  };
}

function parseMetadataAccount(buffer: Buffer): ParsedMetadata {
  let offset = 0;

  offset += 1; // key
  offset += 32; // update authority
  offset += 32; // mint

  const name = readBorshString(buffer, offset);
  offset = name.offset;

  const symbol = readBorshString(buffer, offset);
  offset = symbol.offset;

  const uri = readBorshString(buffer, offset);
  offset = uri.offset;

  offset += 2; // seller fee basis points

  const hasCreators = buffer.readUInt8(offset);
  offset += 1;

  if (hasCreators) {
    const creatorCount = buffer.readUInt32LE(offset);
    offset += 4;
    offset += creatorCount * 34; // address 32 + verified 1 + share 1
  }

  offset += 1; // primary sale happened
  offset += 1; // is mutable

  const hasEditionNonce = buffer.readUInt8(offset);
  offset += 1;

  if (hasEditionNonce) {
    offset += 1;
  }

  if (offset >= buffer.length) {
    return {
      name: name.value,
      symbol: symbol.value,
      uri: uri.value,
    };
  }

  const hasTokenStandard = buffer.readUInt8(offset);
  offset += 1;

  if (hasTokenStandard) {
    offset += 1;
  }

  if (offset >= buffer.length) {
    return {
      name: name.value,
      symbol: symbol.value,
      uri: uri.value,
    };
  }

  const hasCollection = buffer.readUInt8(offset);
  offset += 1;

  let collection: ParsedMetadata["collection"] | undefined;

  if (hasCollection) {
    const verified = buffer.readUInt8(offset) === 1;
    offset += 1;

    const collectionKey = new PublicKey(buffer.subarray(offset, offset + 32));
    offset += 32;

    collection = {
      verified,
      key: collectionKey.toBase58(),
    };
  }

  return {
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
    collection,
  };
}

async function fetchMetadataJson(uri: string) {
  if (!uri || !uri.startsWith("http")) {
    return null;
  }

  try {
    const response = await fetch(uri, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

function mapSupabaseRow(row: SupabaseMintHistoryRow) {
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
    source: "supabase",
  };
}

async function loadSupabaseMintRecords(mintAddresses: string[]) {
  if (mintAddresses.length === 0) {
    return new Map<string, ReturnType<typeof mapSupabaseRow>>();
  }

  const { data, error } = await supabaseAdmin
    .from("mint_history")
    .select("*")
    .in("mint_address", mintAddresses);

  if (error) {
    throw new Error(error.message);
  }

  const records = new Map<string, ReturnType<typeof mapSupabaseRow>>();

  for (const row of (data || []) as SupabaseMintHistoryRow[]) {
    records.set(row.mint_address, mapSupabaseRow(row));
  }

  return records;
}

async function getMetadataPda(mint: PublicKey) {
  const [metadataPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  return metadataPda;
}

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing wallet query parameter.",
        },
        { status: 400 }
      );
    }

    const owner = new PublicKey(wallet);
    const connection = new Connection(RPC_URL, "confirmed");

    const collectionMints = loadCollectionMints();

    if (collectionMints.length === 0) {
      return NextResponse.json({
        success: true,
        wallet,
        nfts: [],
        totals: {
          total: 0,
          pages: 0,
          courtiers: 0,
          royals: 0,
        },
        warning:
          "No local collection state files found. Mint at least one NFT from each collection or ensure collection state JSON files exist.",
      });
    }

    const collectionByMint = new Map(
      collectionMints.map((item) => [item.mint, item])
    );

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    const mintAddresses = tokenAccounts.value
      .map((account) => {
        const parsed = account.account.data.parsed;
        const info = parsed.info;
        const amount = info.tokenAmount;

        if (amount.decimals !== 0) {
          return null;
        }

        if (amount.amount !== "1") {
          return null;
        }

        return String(info.mint);
      })
      .filter(Boolean) as string[];

    const supabaseRecords = await loadSupabaseMintRecords(mintAddresses);

    const nfts = [];

    for (const mintAddress of mintAddresses) {
      const mintPublicKey = new PublicKey(mintAddress);
      const metadataPda = await getMetadataPda(mintPublicKey);
      const metadataAccount = await connection.getAccountInfo(metadataPda);

      if (!metadataAccount) {
        continue;
      }

      const parsedMetadata = parseMetadataAccount(
        Buffer.from(metadataAccount.data)
      );

      const verifiedCollectionMint = parsedMetadata.collection?.verified
        ? parsedMetadata.collection.key
        : null;

      if (!verifiedCollectionMint) {
        continue;
      }

      const collectionMatch = collectionByMint.get(verifiedCollectionMint);

      if (!collectionMatch) {
        continue;
      }

      const existingRecord = supabaseRecords.get(mintAddress);

      if (existingRecord) {
        nfts.push(existingRecord);
        continue;
      }

      const jsonMetadata = await fetchMetadataJson(parsedMetadata.uri);

      const attributes = Array.isArray(jsonMetadata?.attributes)
        ? jsonMetadata.attributes
        : [];

      nfts.push({
        id: `${collectionMatch.collection}-${mintAddress}`,
        timestamp: "",
        network: "devnet",
        collection: collectionMatch.collection,
        name: jsonMetadata?.name || parsedMetadata.name,
        description:
          jsonMetadata?.description ||
          "Vertico NFT found by on-chain wallet scan.",
        attributes,
        mintAddress,
        recipient: wallet,
        paymentSignature: "",
        paymentAmountSol: 0,
        treasuryWallet: "",
        metadataUri: parsedMetadata.uri,
        imageUri: jsonMetadata?.image || "",
        explorer: `https://explorer.solana.com/address/${mintAddress}?cluster=devnet`,
        paymentExplorer: "",
        collectionExplorer: collectionMatch.explorer,
        source: "onchain",
      });
    }

    nfts.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return a.name.localeCompare(b.name);
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;

      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const totals = {
      total: nfts.length,
      pages: nfts.filter((item) => item.collection === "pages").length,
      courtiers: nfts.filter((item) => item.collection === "courtiers").length,
      royals: nfts.filter((item) => item.collection === "royals").length,
    };

    return NextResponse.json({
      success: true,
      wallet,
      nfts,
      totals,
    });
  } catch (error) {
    console.error("My NFTs API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Could not load wallet NFTs.",
      },
      { status: 500 }
    );
  }
}