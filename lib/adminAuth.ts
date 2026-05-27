import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const ADMIN_WALLET = process.env.ADMIN_WALLET;
const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

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

export function verifyAdminSignature({
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
      wallet: null,
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
      wallet: null,
    };
  }

  if (providedWallet !== expectedAdminWallet) {
    return {
      ok: false,
      error: "Unauthorized wallet.",
      wallet: null,
    };
  }

  let message: string;

  try {
    message = decodeBase64(messageBase64);
  } catch {
    return {
      ok: false,
      error: "Invalid admin auth message encoding.",
      wallet: null,
    };
  }

  if (!message.includes("Vertico Admin Dashboard Access")) {
    return {
      ok: false,
      error: "Invalid admin auth message.",
      wallet: null,
    };
  }

  if (!message.includes(`Wallet: ${providedWallet}`)) {
    return {
      ok: false,
      error: "Admin auth message wallet mismatch.",
      wallet: null,
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
      wallet: null,
    };
  }

  const messageAge = Date.now() - timestamp;

  if (messageAge < 0 || messageAge > MAX_MESSAGE_AGE_MS) {
    return {
      ok: false,
      error: "Admin auth message expired.",
      wallet: null,
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
        wallet: null,
      };
    }

    return {
      ok: true,
      error: null,
      wallet: providedWallet,
    };
  } catch {
    return {
      ok: false,
      error: "Could not verify admin wallet signature.",
      wallet: null,
    };
  }
}
