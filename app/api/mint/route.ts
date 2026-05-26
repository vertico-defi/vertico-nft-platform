import { NextRequest, NextResponse } from "next/server";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createNft,
  findMetadataPda,
  mplTokenMetadata,
  verifyCollectionV1,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createSignerFromKeypair,
  generateSigner,
  percentAmount,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey as SolanaPublicKey,
} from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { getMintPriceSol, type CollectionType } from "@/lib/mintPrices";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Trait = {
  category?: string;
  name?: string;
};

type MintAttribute = {
  trait_type: string;
  value: string;
};

type PageItem = {
  src: string;
  alt: string;
  traits?: Trait[];
};

type CourtierItem = {
  CID: string;
  Name: string;
  Description: string;
  traits?: Trait[];
};

type RoyalItem = {
  CID: string;
  Name: string;
  Description: string;
  traits?: Trait[];
};

type ImageUriMap = {
  network: string;
  uploadedAt: string | null;
  images: {
    pages: Record<
      string,
      {
        fileName: string;
        uri: string;
      }
    >;
    courtiers: Record<
      string,
      {
        fileName: string;
        uri: string;
      }
    >;
    royals: Record<
      string,
      {
        fileName: string;
        uri: string;
      }
    >;
  };
};

type PreparedMintData = {
  name: string;
  description: string;
  imagePath: string;
  attributes: MintAttribute[];
};

type MintHistoryEntry = {
  id: string;
  timestamp: string;
  network: "devnet";
  collection: CollectionType;
  name: string;
  description: string;
  attributes: MintAttribute[];
  mintAddress: string;
  recipient: string;
  paymentSignature: string;
  paymentAmountSol: number;
  treasuryWallet: string;
  metadataUri: string;
  imageUri: string;
  explorer: string;
  paymentExplorer: string;
  collectionExplorer: string;
};

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

const SOLANA_SECRET_KEY = process.env.SOLANA_SECRET_KEY;

const WALLET_PATH =
  process.env.SOLANA_WALLET_PATH || "/home/riki/.config/solana/id.json";

const TREASURY_WALLET =
  process.env.TREASURY_WALLET || process.env.NEXT_PUBLIC_TREASURY_WALLET;

const PROJECT_ROOT = process.cwd();

const IMAGE_URI_MAP_PATH = path.join(
  PROJECT_ROOT,
  "data",
  "image-uris-devnet.json"
);

const CONFIG = {
  pages: {
    collectionName: "Pages",
    collectionSymbol: "PAGES",
    collectionDescription:
      "The Pages collection: royal page character NFTs for the Vertico project.",
    dataPath: path.join(PROJECT_ROOT, "data", "pages.json"),
    imageFolder: path.join(PROJECT_ROOT, "public", "assets", "pages"),
    collectionStatePaths: [
      path.join(PROJECT_ROOT, "data", "pages-collection-devnet.json"),
      path.join(PROJECT_ROOT, "..", "data", "pages-collection-devnet.json"),
    ],
  },
  courtiers: {
    collectionName: "Courtiers",
    collectionSymbol: "COURTIERS",
    collectionDescription:
      "The Courtiers collection: royal court character NFTs for the Vertico project.",
    dataPath: path.join(PROJECT_ROOT, "data", "courtiers.json"),
    imageFolder: path.join(PROJECT_ROOT, "public", "assets", "courtiers"),
    collectionStatePaths: [
      path.join(PROJECT_ROOT, "data", "courtiers-collection-devnet.json"),
      path.join(PROJECT_ROOT, "..", "data", "courtiers-collection-devnet.json"),
    ],
  },
  royals: {
    collectionName: "Royals",
    collectionSymbol: "ROYALS",
    collectionDescription:
      "The Royals collection: premium royal character NFTs for the Vertico project.",
    dataPath: path.join(PROJECT_ROOT, "data", "royals.json"),
    imageFolder: path.join(PROJECT_ROOT, "public", "assets", "royals"),
    collectionStatePaths: [
      path.join(PROJECT_ROOT, "data", "royals-collection-devnet.json"),
      path.join(PROJECT_ROOT, "..", "data", "royals-collection-devnet.json"),
    ],
  },
} as const;

const EXCLUDED_COURTIER_NAMES = ["Lady Amelia Wentworth"];

function loadJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadSolanaSecretKey() {
  if (SOLANA_SECRET_KEY) {
    try {
      const parsedSecretKey = JSON.parse(SOLANA_SECRET_KEY);

      if (!Array.isArray(parsedSecretKey)) {
        throw new Error("SOLANA_SECRET_KEY must be a JSON array.");
      }

      return new Uint8Array(parsedSecretKey);
    } catch {
      throw new Error(
        "Invalid SOLANA_SECRET_KEY. It must look like [1,2,3,...]."
      );
    }
  }

  if (!fs.existsSync(WALLET_PATH)) {
    throw new Error(
      "Missing SOLANA_SECRET_KEY and SOLANA_WALLET_PATH file does not exist."
    );
  }

  const secretKeyFromFile = JSON.parse(fs.readFileSync(WALLET_PATH, "utf8"));

  if (!Array.isArray(secretKeyFromFile)) {
    throw new Error("SOLANA_WALLET_PATH file must contain a JSON array.");
  }

  return new Uint8Array(secretKeyFromFile);
}

async function hasPaymentSignatureBeenUsed(signature: string) {
  const { data, error } = await supabaseAdmin
    .from("used_payment_signatures")
    .select("payment_signature")
    .eq("payment_signature", signature)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

async function saveUsedPaymentSignature({
  paymentSignature,
  walletAddress,
  collection,
}: {
  paymentSignature: string;
  walletAddress: string;
  collection: CollectionType;
}) {
  const { error } = await supabaseAdmin.from("used_payment_signatures").insert({
    payment_signature: paymentSignature,
    wallet_address: walletAddress,
    collection,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function saveMintHistoryEntry(entry: MintHistoryEntry) {
  const { error } = await supabaseAdmin.from("mint_history").insert({
    id: entry.id,
    timestamp: entry.timestamp,
    network: entry.network,
    collection: entry.collection,
    name: entry.name,
    description: entry.description,
    attributes: entry.attributes,
    mint_address: entry.mintAddress,
    recipient: entry.recipient,
    payment_signature: entry.paymentSignature,
    payment_amount_sol: entry.paymentAmountSol,
    treasury_wallet: entry.treasuryWallet,
    metadata_uri: entry.metadataUri,
    image_uri: entry.imageUri,
    explorer: entry.explorer,
    payment_explorer: entry.paymentExplorer,
    collection_explorer: entry.collectionExplorer,
  });

  if (error) {
    throw new Error(error.message);
  }
}

function getExistingCollectionStatePath(collection: CollectionType) {
  const paths = CONFIG[collection].collectionStatePaths;

  for (const statePath of paths) {
    if (fs.existsSync(statePath)) {
      return statePath;
    }
  }

  return paths[0];
}

function normalizePages(raw: any): PageItem[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.Pages)) return raw.Pages;
  if (Array.isArray(raw.pages)) return raw.pages;
  if (Array.isArray(raw.data)) return raw.data;

  throw new Error("Could not understand pages.json structure.");
}

function normalizeCourtiers(raw: any): CourtierItem[] {
  let courtiers: CourtierItem[] = [];

  if (Array.isArray(raw)) {
    courtiers = raw;
  } else if (Array.isArray(raw.Courtiers)) {
    courtiers = raw.Courtiers;
  } else if (Array.isArray(raw.courtiers)) {
    courtiers = raw.courtiers;
  } else if (Array.isArray(raw.data)) {
    courtiers = raw.data;
  } else {
    throw new Error("Could not understand courtiers.json structure.");
  }

  return courtiers.filter(
    (courtier) => !EXCLUDED_COURTIER_NAMES.includes(courtier.Name)
  );
}

function normalizeRoyals(raw: any): RoyalItem[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.Royals)) return raw.Royals;
  if (Array.isArray(raw.royals)) return raw.royals;
  if (Array.isArray(raw.data)) return raw.data;

  throw new Error("Could not understand royals.json structure.");
}

function pickRandom<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("No valid items available for minting.");
  }

  const randomIndex = Math.floor(Math.random() * items.length);
  return items[randomIndex];
}

function parsePageAlt(page: PageItem) {
  const alt = page.alt || `Page ${page.src}`;
  const parts = alt.split("-").map((part) => part.trim());

  return {
    name: parts[0] || `Page ${page.src}`,
    description:
      parts.slice(1).join(" - ") ||
      "A royal Page NFT from the Vertico Pages collection.",
  };
}

function getNumberFromString(value: string) {
  const match = String(value).match(/\d+/);

  if (!match) {
    throw new Error(`Could not extract number from: ${value}`);
  }

  return match[0];
}

function findImageByExactBaseName(imageFolder: string, baseName: string) {
  const files = fs.readdirSync(imageFolder);

  const match = files.find((file) => {
    const fileNameWithoutExtension = path.parse(file).name;
    return fileNameWithoutExtension.toLowerCase() === baseName.toLowerCase();
  });

  if (!match) {
    throw new Error(`Could not find image for: ${baseName}`);
  }

  return path.join(imageFolder, match);
}

function findImageByNumber(imageFolder: string, imageNumber: string) {
  const files = fs.readdirSync(imageFolder);

  const match = files.find((file) => {
    const fileNameWithoutExtension = path.parse(file).name;
    return fileNameWithoutExtension === imageNumber;
  });

  if (!match) {
    throw new Error(`Could not find image number: ${imageNumber}`);
  }

  return path.join(imageFolder, match);
}

function getContentType(imagePath: string) {
  const lower = imagePath.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg")) return "image/jpeg";
  if (lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";

  throw new Error(`Unsupported image type: ${imagePath}`);
}

function getUploadedImageUri(collection: CollectionType, imagePath: string) {
  if (!fs.existsSync(IMAGE_URI_MAP_PATH)) {
    throw new Error(`Missing uploaded image URI map: ${IMAGE_URI_MAP_PATH}`);
  }

  const imageUriMap = loadJson(IMAGE_URI_MAP_PATH) as ImageUriMap;
  const baseName = path.parse(imagePath).name;

  const uri = imageUriMap.images?.[collection]?.[baseName]?.uri;

  if (!uri) {
    throw new Error(
      `Missing uploaded Irys image URI for ${collection}/${baseName}`
    );
  }

  return uri;
}

function buildPageAttributes(page: PageItem): MintAttribute[] {
  const allowedCategories = [
    "Tits",
    "Hair Color",
    "Eye Color",
    "Figure",
    "Pose",
    "Complexion",
    "Expression",
  ];

  const parsed = parsePageAlt(page);

  const attributes: MintAttribute[] = [
    {
      trait_type: "Description",
      value: parsed.description,
    },
  ];

  for (const category of allowedCategories) {
    const trait = page.traits?.find(
      (item) =>
        String(item.category).toLowerCase() === String(category).toLowerCase()
    );

    if (trait?.name) {
      attributes.push({
        trait_type: category,
        value: trait.name,
      });
    }
  }

  return attributes;
}

function buildStandardAttributes(
  description: string,
  traits?: Trait[]
): MintAttribute[] {
  const attributes: MintAttribute[] = [
    {
      trait_type: "Description",
      value: description,
    },
  ];

  if (Array.isArray(traits)) {
    for (const trait of traits) {
      if (trait.category && trait.name) {
        attributes.push({
          trait_type: trait.category,
          value: trait.name,
        });
      }
    }
  }

  return attributes;
}

function setupUmi() {
  const umi = createUmi(RPC_URL).use(mplTokenMetadata()).use(irysUploader());

  const secretKey = loadSolanaSecretKey();

  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);

  const signer = createSignerFromKeypair(umi, keypair);

  umi.use(signerIdentity(signer));

  return {
    umi,
    signer,
  };
}

async function createOrLoadCollection(
  umi: ReturnType<typeof createUmi>,
  collection: CollectionType
) {
  const config = CONFIG[collection];
  const statePath = getExistingCollectionStatePath(collection);

  if (fs.existsSync(statePath)) {
    const saved = loadJson(statePath);

    if (!saved.collectionMint) {
      throw new Error(`Collection state is missing collectionMint: ${statePath}`);
    }

    return publicKey(saved.collectionMint);
  }

  const collectionMint = generateSigner(umi);

  const collectionMetadataUri = await umi.uploader.uploadJson({
    name: config.collectionName,
    symbol: config.collectionSymbol,
    description: config.collectionDescription,
    image: "",
    attributes: [
      {
        trait_type: "Collection Type",
        value: config.collectionName,
      },
      {
        trait_type: "Network",
        value: "Devnet",
      },
      {
        trait_type: "Project",
        value: "Vertico",
      },
    ],
  });

  await createNft(umi, {
    mint: collectionMint,
    name: config.collectionName,
    symbol: config.collectionSymbol,
    uri: collectionMetadataUri,
    sellerFeeBasisPoints: percentAmount(5),
    isCollection: true,
  }).sendAndConfirm(umi);

  const state = {
    collectionName: config.collectionName,
    collectionSymbol: config.collectionSymbol,
    collectionMint: collectionMint.publicKey.toString(),
    network: "devnet",
    explorer: `https://explorer.solana.com/address/${collectionMint.publicKey}?cluster=devnet`,
  };

  saveJson(statePath, state);

  return collectionMint.publicKey;
}

function prepareMintData(collection: CollectionType): PreparedMintData {
  const config = CONFIG[collection];
  const raw = loadJson(config.dataPath);

  if (collection === "pages") {
    const page = pickRandom(normalizePages(raw));
    const parsed = parsePageAlt(page);
    const imageNumber = getNumberFromString(page.src);
    const imagePath = findImageByNumber(config.imageFolder, imageNumber);

    return {
      name: parsed.name,
      description: parsed.description,
      imagePath,
      attributes: buildPageAttributes(page),
    };
  }

  if (collection === "courtiers") {
    const courtier = pickRandom(normalizeCourtiers(raw));
    const imagePath = findImageByExactBaseName(
      config.imageFolder,
      courtier.Name
    );

    return {
      name: courtier.Name,
      description: courtier.Description,
      imagePath,
      attributes: buildStandardAttributes(
        courtier.Description,
        courtier.traits
      ),
    };
  }

  const royal = pickRandom(normalizeRoyals(raw));
  const imageNumber = getNumberFromString(royal.CID);
  const imagePath = findImageByNumber(config.imageFolder, imageNumber);

  return {
    name: royal.Name,
    description: royal.Description,
    imagePath,
    attributes: buildStandardAttributes(royal.Description, royal.traits),
  };
}

async function verifyPayment({
  paymentSignature,
  walletAddress,
  collection,
}: {
  paymentSignature: string;
  walletAddress: string;
  collection: CollectionType;
}) {
  if (!TREASURY_WALLET) {
    throw new Error("Missing TREASURY_WALLET or NEXT_PUBLIC_TREASURY_WALLET.");
  }

  if (await hasPaymentSignatureBeenUsed(paymentSignature)) {
    throw new Error("This payment signature has already been used.");
  }

  const connection = new Connection(RPC_URL, "confirmed");

  const transaction = await connection.getParsedTransaction(paymentSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction) {
    throw new Error("Could not find payment transaction on devnet.");
  }

  if (transaction.meta?.err) {
    throw new Error("Payment transaction failed on-chain.");
  }

  const expectedLamports = Math.round(
    getMintPriceSol(collection) * LAMPORTS_PER_SOL
  );

  const expectedSource = new SolanaPublicKey(walletAddress).toBase58();
  const expectedDestination = new SolanaPublicKey(TREASURY_WALLET).toBase58();

  const instructions = transaction.transaction.message.instructions;

  const validTransfer = instructions.some((instruction: any) => {
    if (!("parsed" in instruction)) {
      return false;
    }

    if (instruction.program !== "system") {
      return false;
    }

    if (instruction.parsed?.type !== "transfer") {
      return false;
    }

    const info = instruction.parsed.info;

    const source = new SolanaPublicKey(info.source).toBase58();
    const destination = new SolanaPublicKey(info.destination).toBase58();
    const lamports = Number(info.lamports);

    return (
      source === expectedSource &&
      destination === expectedDestination &&
      lamports >= expectedLamports
    );
  });

  if (!validTransfer) {
    throw new Error(
      `Payment verification failed. Expected ${getMintPriceSol(
        collection
      )} devnet SOL from ${expectedSource} to ${expectedDestination}.`
    );
  }

  return {
    paymentSignature,
    expectedLamports,
    expectedSol: getMintPriceSol(collection),
    treasuryWallet: expectedDestination,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const collection = body.collection as CollectionType;
    const walletAddress = body.walletAddress as string;
    const paymentSignature = body.paymentSignature as string;

    if (!["pages", "courtiers", "royals"].includes(collection)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid collection. Use pages, courtiers, or royals.",
        },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing wallet address.",
        },
        { status: 400 }
      );
    }

    if (!paymentSignature) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing payment signature.",
        },
        { status: 400 }
      );
    }

    const recipient = publicKey(walletAddress);
    const config = CONFIG[collection];

    const payment = await verifyPayment({
      paymentSignature,
      walletAddress,
      collection,
    });

    const { umi, signer } = setupUmi();

    const collectionMint = await createOrLoadCollection(umi, collection);
    const mintData = prepareMintData(collection);

    const imageUri = getUploadedImageUri(collection, mintData.imagePath);
    const contentType = getContentType(mintData.imagePath);

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;

    const metadataUri = await umi.uploader.uploadJson({
      name: mintData.name,
      symbol: config.collectionSymbol,
      description: mintData.description,
      image: imageUri,
      external_url: siteUrl,
      attributes: mintData.attributes,
      properties: {
        category: "image",
        files: [
          {
            uri: imageUri,
            type: contentType,
          },
        ],
        creators: [
          {
            address: signer.publicKey.toString(),
            share: 100,
          },
        ],
      },
    });

    const mint = generateSigner(umi);

    await createNft(umi, {
      mint,
      name: mintData.name,
      symbol: config.collectionSymbol,
      uri: metadataUri,
      sellerFeeBasisPoints: percentAmount(5),
      tokenOwner: recipient,
      collection: {
        key: collectionMint,
        verified: false,
      },
    }).sendAndConfirm(umi);

    const metadata = findMetadataPda(umi, {
      mint: mint.publicKey,
    });

    await verifyCollectionV1(umi, {
      metadata,
      collectionMint,
      authority: umi.identity,
    }).sendAndConfirm(umi);

    const mintAddress = mint.publicKey.toString();

    const mintHistoryEntry: MintHistoryEntry = {
      id: `${collection}-${mintAddress}`,
      timestamp: new Date().toISOString(),
      network: "devnet",
      collection,
      name: mintData.name,
      description: mintData.description,
      attributes: mintData.attributes,
      mintAddress,
      recipient: walletAddress,
      paymentSignature: payment.paymentSignature,
      paymentAmountSol: payment.expectedSol,
      treasuryWallet: payment.treasuryWallet,
      metadataUri,
      imageUri,
      explorer: `https://explorer.solana.com/address/${mint.publicKey}?cluster=devnet`,
      paymentExplorer: `https://explorer.solana.com/tx/${payment.paymentSignature}?cluster=devnet`,
      collectionExplorer: `https://explorer.solana.com/address/${collectionMint}?cluster=devnet`,
    };

    await saveUsedPaymentSignature({
      paymentSignature,
      walletAddress,
      collection,
    });

    await saveMintHistoryEntry(mintHistoryEntry);

    return NextResponse.json({
      success: true,
      ...mintHistoryEntry,
    });
  } catch (error) {
    console.error("Mint API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown mint error.",
      },
      { status: 500 }
    );
  }
}