import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";

export type VerticoCollectionType = "pages" | "courtiers" | "royals";

type ParsedMetadata = {
  name: string;
  symbol: string;
  uri: string;
  collection?: {
    verified: boolean;
    key: string;
  };
};

export type VerifiedVerticoNativeNft = {
  walletAddress: string;
  mintAddress: string;
  collectionType: VerticoCollectionType;
  name: string;
  description: string;
  imageUrl: string | null;
  metadataUri: string;
  attributes: unknown[];
};

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

const PROJECT_ROOT = process.cwd();

const COLLECTION_STATE_PATHS: Record<VerticoCollectionType, string[]> = {
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
    collection: VerticoCollectionType;
    mint: string;
  }[] = [];

  for (const collection of Object.keys(
    COLLECTION_STATE_PATHS
  ) as VerticoCollectionType[]) {
    for (const statePath of COLLECTION_STATE_PATHS[collection]) {
      if (!fs.existsSync(statePath)) {
        continue;
      }

      const state = loadJson(statePath);

      if (state.collectionMint) {
        collections.push({
          collection,
          mint: String(state.collectionMint),
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
    offset += creatorCount * 34;
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

function getMetadataPda(mint: PublicKey) {
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

    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyVerticoNativeNftOwnership({
  walletAddress,
  mintAddress,
}: {
  walletAddress: string;
  mintAddress: string;
}): Promise<VerifiedVerticoNativeNft> {
  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(mintAddress);
  const connection = new Connection(RPC_URL, "confirmed");

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
    mint,
  });

  const ownedTokenAccount = tokenAccounts.value.find((account) => {
    const parsed = account.account.data.parsed;
    const amount = parsed.info.tokenAmount;

    return amount.decimals === 0 && amount.amount === "1";
  });

  if (!ownedTokenAccount) {
    throw new Error("Connected wallet does not currently own this NFT.");
  }

  const collectionMints = loadCollectionMints();

  if (collectionMints.length === 0) {
    throw new Error("Vertico collection state files are not available.");
  }

  const collectionByMint = new Map(
    collectionMints.map((item) => [item.mint, item])
  );

  const metadataPda = getMetadataPda(mint);
  const metadataAccount = await connection.getAccountInfo(metadataPda);

  if (!metadataAccount) {
    throw new Error("NFT metadata account was not found.");
  }

  const parsedMetadata = parseMetadataAccount(Buffer.from(metadataAccount.data));
  const verifiedCollectionMint = parsedMetadata.collection?.verified
    ? parsedMetadata.collection.key
    : null;

  if (!verifiedCollectionMint) {
    throw new Error("NFT does not have a verified collection.");
  }

  const collectionMatch = collectionByMint.get(verifiedCollectionMint);

  if (!collectionMatch) {
    throw new Error("NFT does not belong to a verified Vertico collection.");
  }

  const jsonMetadata = await fetchMetadataJson(parsedMetadata.uri);

  if (!jsonMetadata) {
    throw new Error("NFT metadata JSON could not be read.");
  }

  return {
    walletAddress: owner.toBase58(),
    mintAddress: mint.toBase58(),
    collectionType: collectionMatch.collection,
    name:
      typeof jsonMetadata.name === "string" && jsonMetadata.name.trim()
        ? jsonMetadata.name.trim()
        : parsedMetadata.name,
    description:
      typeof jsonMetadata.description === "string"
        ? jsonMetadata.description
        : "Vertico native NFT.",
    imageUrl:
      typeof jsonMetadata.image === "string" && jsonMetadata.image.trim()
        ? jsonMetadata.image.trim()
        : null,
    metadataUri: parsedMetadata.uri,
    attributes: Array.isArray(jsonMetadata.attributes)
      ? jsonMetadata.attributes
      : [],
  };
}
