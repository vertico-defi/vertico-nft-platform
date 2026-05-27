import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/adminAuth";
import { revalidateActiveNativeListings } from "@/lib/nativeListingRevalidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = verifyAdminSignature({
      wallet: request.headers.get("x-admin-wallet"),
      messageBase64: request.headers.get("x-admin-message-base64"),
      signature: request.headers.get("x-admin-signature"),
    });

    if (!auth.ok || !auth.wallet) {
      return NextResponse.json(
        { success: false, error: auth.error || "Unauthorized." },
        { status: 401 }
      );
    }

    const results = await revalidateActiveNativeListings({
      actorWallet: auth.wallet,
      writeReview: true,
    });

    return NextResponse.json({
      success: true,
      results,
      checked: results.length,
      suspended: results.filter((result) => !result.isCurrentOwner).length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not revalidate native listings.",
      },
      { status: 500 }
    );
  }
}
