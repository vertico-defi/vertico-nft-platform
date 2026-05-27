import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requiredString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.targetType !== "collection" && body.targetType !== "listing") {
      return NextResponse.json(
        { success: false, error: "Report target type is invalid." },
        { status: 400 }
      );
    }

    if (!requiredString(body.targetId) || !requiredString(body.reason)) {
      return NextResponse.json(
        { success: false, error: "Target and reason are required." },
        { status: 400 }
      );
    }

    const table =
      body.targetType === "collection"
        ? "marketplace_collections"
        : "marketplace_listings";

    let targetQuery = supabaseAdmin
      .from(table)
      .select("id, status")
      .eq("id", body.targetId)
      .eq("status", "approved");

    if (body.targetType === "listing") {
      targetQuery = targetQuery.eq("sale_status", "listed");
    }

    const { data: target, error: targetError } = await targetQuery.maybeSingle();

    if (targetError) throw new Error(targetError.message);

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Only approved public content can be reported." },
        { status: 404 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("content_reports")
      .insert({
        target_type: body.targetType,
        target_id: body.targetId,
        reporter_wallet: requiredString(body.reporterWallet)
          ? body.reporterWallet.trim()
          : null,
        reason: body.reason.trim(),
        details: requiredString(body.details) ? body.details.trim() : null,
        status: "open",
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, report: data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not create content report.",
      },
      { status: 500 }
    );
  }
}
