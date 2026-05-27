import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

const MAX_MESSAGE_AGE_MS = 5 * 60 * 1000;

function decodeBase64(value: string) {
  return Buffer.from(value, "base64").toString("utf8");
}

function getTimestampFromMessage(message: string) {
  const timestampLine = message
    .split("\n")
    .find((line) => line.startsWith("Timestamp:"));

  if (!timestampLine) {
    throw new Error("Wallet auth message is missing timestamp.");
  }

  const timestamp = Number(timestampLine.replace("Timestamp:", "").trim());

  if (!Number.isFinite(timestamp)) {
    throw new Error("Wallet auth message has invalid timestamp.");
  }

  return timestamp;
}

export function verifyWalletSignature({
  wallet,
  messageBase64,
  signature,
  requiredLines,
}: {
  wallet: string;
  messageBase64: string | null;
  signature: string | null;
  requiredLines: string[];
}) {
  if (!messageBase64 || !signature) {
    return {
      ok: false,
      error: "Missing wallet authentication headers.",
    };
  }

  let normalizedWallet: string;

  try {
    normalizedWallet = new PublicKey(wallet).toBase58();
  } catch {
    return {
      ok: false,
      error: "Invalid wallet address.",
    };
  }

  let message: string;

  try {
    message = decodeBase64(messageBase64);
  } catch {
    return {
      ok: false,
      error: "Invalid wallet auth message encoding.",
    };
  }

  const expectedLines = [
    "Vertico Native Marketplace Listing",
    `Wallet: ${normalizedWallet}`,
    ...requiredLines,
  ];

  for (const line of expectedLines) {
    if (!message.includes(line)) {
      return {
        ok: false,
        error: "Wallet auth message does not match this listing action.",
      };
    }
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
          : "Wallet auth message timestamp error.",
    };
  }

  const messageAge = Date.now() - timestamp;

  if (messageAge < 0 || messageAge > MAX_MESSAGE_AGE_MS) {
    return {
      ok: false,
      error: "Wallet auth message expired.",
    };
  }

  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(signature, "base64");
    const publicKeyBytes = new PublicKey(normalizedWallet).toBytes();

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    return {
      ok: isValid,
      error: isValid ? null : "Invalid wallet signature.",
    };
  } catch {
    return {
      ok: false,
      error: "Could not verify wallet signature.",
    };
  }
}
