import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/adminAuth";
import {
  type DiagnosticCheck,
  runMarketplaceSchemaDiagnostics,
} from "@/lib/schemaDiagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authError(error: string | null) {
  return NextResponse.json(
    { success: false, error: error || "Unauthorized." },
    { status: 401 }
  );
}

function configuredCheck(name: string, configured: boolean): DiagnosticCheck {
  return {
    name,
    status: configured ? "ok" : "error",
    message: configured
      ? `${name} is configured.`
      : `${name} is missing. Configure it before public testing.`,
  };
}

function fileCheck(name: string, filePath: string): DiagnosticCheck {
  const exists = fs.existsSync(filePath);

  return {
    name,
    status: exists ? "ok" : "error",
    message: exists
      ? `${name} exists.`
      : `${name} is missing at ${path.relative(process.cwd(), filePath)}.`,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = verifyAdminSignature({
      wallet: request.headers.get("x-admin-wallet"),
      messageBase64: request.headers.get("x-admin-message-base64"),
      signature: request.headers.get("x-admin-signature"),
    });

    if (!auth.ok) return authError(auth.error);

    const checks: DiagnosticCheck[] = [
      configuredCheck(
        "Supabase URL",
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)
      ),
      configuredCheck(
        "Supabase service role",
        Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
      ),
      configuredCheck("Admin wallet", Boolean(process.env.ADMIN_WALLET)),
      configuredCheck(
        "Treasury wallet",
        Boolean(process.env.NEXT_PUBLIC_TREASURY_WALLET)
      ),
      configuredCheck("Solana RPC", Boolean(process.env.SOLANA_RPC_URL)),
      fileCheck(
        "Pages collection state",
        path.join(process.cwd(), "data", "pages-collection-devnet.json")
      ),
      fileCheck(
        "Courtiers collection state",
        path.join(process.cwd(), "data", "courtiers-collection-devnet.json")
      ),
      fileCheck(
        "Royals collection state",
        path.join(process.cwd(), "data", "royals-collection-devnet.json")
      ),
      fileCheck(
        "Image URI map",
        path.join(process.cwd(), "data", "image-uris-devnet.json")
      ),
      ...(await runMarketplaceSchemaDiagnostics()),
    ];

    return NextResponse.json({
      success: true,
      checks,
    });
  } catch (error) {
    console.error("Admin diagnostics failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Could not run diagnostics.",
      },
      { status: 500 }
    );
  }
}
