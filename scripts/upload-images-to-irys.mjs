import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  createGenericFile,
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = process.cwd();

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const SOLANA_SECRET_KEY = process.env.SOLANA_SECRET_KEY;

const WALLET_PATH =
  process.env.SOLANA_WALLET_PATH || "/home/riki/.config/solana/id.json";

const OUTPUT_PATH = path.join(PROJECT_ROOT, "data", "image-uris-devnet.json");

const IMAGE_FOLDERS = {
  pages: path.join(PROJECT_ROOT, "public", "assets", "pages"),
  courtiers: path.join(PROJECT_ROOT, "public", "assets", "courtiers"),
  royals: path.join(PROJECT_ROOT, "public", "assets", "royals"),
};

function loadSolanaSecretKey() {
  if (SOLANA_SECRET_KEY) {
    const parsedSecretKey = JSON.parse(SOLANA_SECRET_KEY);

    if (!Array.isArray(parsedSecretKey)) {
      throw new Error("SOLANA_SECRET_KEY must be a JSON array.");
    }

    return new Uint8Array(parsedSecretKey);
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

function setupUmi() {
  const umi = createUmi(RPC_URL).use(irysUploader());

  const secretKey = loadSolanaSecretKey();

  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  const signer = createSignerFromKeypair(umi, keypair);

  umi.use(signerIdentity(signer));

  return umi;
}

function getContentType(filePath) {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg")) return "image/jpeg";
  if (lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";

  throw new Error(`Unsupported image type: ${filePath}`);
}

function loadExistingOutput() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return {
      network: "devnet",
      uploadedAt: null,
      images: {
        pages: {},
        courtiers: {},
        royals: {},
      },
    };
  }

  return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
}

async function uploadImage(umi, filePath) {
  const imageBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const contentType = getContentType(filePath);

  const file = createGenericFile(new Uint8Array(imageBuffer), fileName, {
    contentType,
  });

  const [uri] = await umi.uploader.upload([file]);

  return uri;
}

async function main() {
  console.log("Starting Vertico image upload to Irys...");
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Output: ${OUTPUT_PATH}`);

  const umi = setupUmi();
  const output = loadExistingOutput();

  output.network = "devnet";

  let uploadedCount = 0;
  let skippedCount = 0;

  for (const [collection, folderPath] of Object.entries(IMAGE_FOLDERS)) {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Missing image folder: ${folderPath}`);
    }

    output.images[collection] ||= {};

    const files = fs
      .readdirSync(folderPath)
      .filter((file) => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .sort((a, b) => a.localeCompare(b));

    console.log(`\nCollection: ${collection}`);
    console.log(`Found ${files.length} image(s).`);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const baseName = path.parse(file).name;

      if (output.images[collection][baseName]) {
        console.log(`SKIP ${collection}/${file}`);
        skippedCount += 1;
        continue;
      }

      console.log(`UPLOAD ${collection}/${file}`);

      const uri = await uploadImage(umi, filePath);

      output.images[collection][baseName] = {
        fileName: file,
        uri,
      };

      output.uploadedAt = new Date().toISOString();

      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

      console.log(`DONE ${uri}`);

      uploadedCount += 1;
    }
  }

  console.log("\nUpload complete.");
  console.log(`Uploaded: ${uploadedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Saved: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error("Upload failed:");
  console.error(error);
  process.exit(1);
});