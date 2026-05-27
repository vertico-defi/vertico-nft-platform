import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSignature } from "@/lib/adminAuth";
import { revalidateNativeListingOwnership } from "@/lib/nativeListingRevalidation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminAction =
  | "approve_creator"
  | "reject_creator"
  | "suspend_creator"
  | "approve_collection_submission"
  | "reject_collection_submission"
  | "suspend_marketplace_collection"
  | "hide_listing"
  | "suspend_listing"
  | "revalidate_listing_ownership"
  | "review_report"
  | "resolve_report"
  | "dismiss_report"
  | "suspend_report_target";

function getAdminAuth(request: NextRequest) {
  return verifyAdminSignature({
    wallet: request.headers.get("x-admin-wallet"),
    messageBase64: request.headers.get("x-admin-message-base64"),
    signature: request.headers.get("x-admin-signature"),
  });
}

function authError(error: string | null) {
  return NextResponse.json(
    { success: false, error: error || "Unauthorized." },
    { status: 401 }
  );
}

async function writeReview({
  adminWallet,
  targetType,
  targetId,
  decision,
  notes,
}: {
  adminWallet: string;
  targetType: string;
  targetId: string;
  decision: string;
  notes: string | null;
}) {
  const { error } = await supabaseAdmin.from("moderation_reviews").insert({
    admin_wallet: adminWallet,
    target_type: targetType,
    target_id: targetId,
    decision,
    notes,
  });

  if (error) throw new Error(error.message);
}

async function writeAudit({
  adminWallet,
  eventType,
  targetType,
  targetId,
  metadata = {},
}: {
  adminWallet: string;
  eventType: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor_wallet: adminWallet,
    event_type: eventType,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });

  if (error) throw new Error(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAdminAuth(request);

    if (!auth.ok) return authError(auth.error);

    const [
      pendingCreators,
      pendingSubmissions,
      openReports,
      approvedCollections,
      nativeListings,
      suspendedCollections,
      suspendedListings,
      auditLogs,
    ] = await Promise.all([
      supabaseAdmin
        .from("creator_profiles")
        .select("*")
        .eq("creator_status", "pending")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("collection_submissions")
        .select("*, creator_profiles(display_name, wallet_address, email)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("content_reports")
        .select("*")
        .in("status", ["open", "reviewing"])
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("marketplace_collections")
        .select("*, creator_profiles(display_name, wallet_address)")
        .eq("status", "approved")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("marketplace_listings")
        .select("*")
        .eq("source", "vertico_native")
        .in("sale_status", ["listed", "hidden"])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("marketplace_collections")
        .select("*, creator_profiles(display_name, wallet_address)")
        .eq("status", "suspended")
        .order("updated_at", { ascending: false }),
      supabaseAdmin
        .from("marketplace_listings")
        .select("*")
        .eq("source", "vertico_native")
        .eq("status", "suspended")
        .order("updated_at", { ascending: false }),
      supabaseAdmin
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    for (const result of [
      pendingCreators,
      pendingSubmissions,
      openReports,
      approvedCollections,
      nativeListings,
      suspendedCollections,
      suspendedListings,
      auditLogs,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    return NextResponse.json({
      success: true,
      pendingCreators: pendingCreators.data || [],
      pendingSubmissions: pendingSubmissions.data || [],
      openReports: openReports.data || [],
      approvedCollections: approvedCollections.data || [],
      nativeListings: nativeListings.data || [],
      suspendedCollections: suspendedCollections.data || [],
      suspendedListings: suspendedListings.data || [],
      auditLogs: auditLogs.data || [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load marketplace admin data.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAdminAuth(request);

    if (!auth.ok || !auth.wallet) return authError(auth.error);

    const body = (await request.json()) as {
      action?: AdminAction;
      targetId?: string;
      notes?: string;
    };

    if (!body.action || !body.targetId) {
      return NextResponse.json(
        { success: false, error: "Action and targetId are required." },
        { status: 400 }
      );
    }

    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    if (
      body.action === "approve_creator" ||
      body.action === "reject_creator" ||
      body.action === "suspend_creator"
    ) {
      const nextStatus =
        body.action === "approve_creator"
          ? "approved"
          : body.action === "reject_creator"
            ? "rejected"
            : "suspended";

      const { data, error } = await supabaseAdmin
        .from("creator_profiles")
        .update({ creator_status: nextStatus, admin_notes: notes })
        .eq("id", body.targetId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "creator_profile",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "creator_profile",
        targetId: body.targetId,
        metadata: { nextStatus },
      });

      return NextResponse.json({ success: true, result: data });
    }

    if (
      body.action === "reject_collection_submission" ||
      body.action === "approve_collection_submission"
    ) {
      if (body.action === "reject_collection_submission") {
        const { data, error } = await supabaseAdmin
          .from("collection_submissions")
          .update({ status: "rejected", admin_notes: notes })
          .eq("id", body.targetId)
          .select("*")
          .single();

        if (error) throw new Error(error.message);

        await writeReview({
          adminWallet: auth.wallet,
          targetType: "collection_submission",
          targetId: body.targetId,
          decision: body.action,
          notes,
        });
        await writeAudit({
          adminWallet: auth.wallet,
          eventType: body.action,
          targetType: "collection_submission",
          targetId: body.targetId,
        });

        return NextResponse.json({ success: true, result: data });
      }

      const { data: submission, error: submissionError } = await supabaseAdmin
        .from("collection_submissions")
        .select("*")
        .eq("id", body.targetId)
        .single();

      if (submissionError) throw new Error(submissionError.message);

      const { error: updateError } = await supabaseAdmin
        .from("collection_submissions")
        .update({ status: "approved", admin_notes: notes })
        .eq("id", body.targetId);

      if (updateError) throw new Error(updateError.message);

      const { data: marketplaceCollection, error: insertError } =
        await supabaseAdmin
          .from("marketplace_collections")
          .upsert(
            {
              submission_id: submission.id,
              creator_id: submission.creator_id,
              collection_name: submission.collection_name,
              chain: submission.chain,
              collection_address: submission.collection_address,
              description: submission.description,
              preview_image_urls: submission.preview_image_urls || [],
              status: "approved",
            },
            { onConflict: "submission_id" }
          )
          .select("*")
          .single();

      if (insertError) throw new Error(insertError.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "collection_submission",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "collection_submission",
        targetId: body.targetId,
        metadata: { marketplaceCollectionId: marketplaceCollection.id },
      });

      return NextResponse.json({
        success: true,
        result: marketplaceCollection,
      });
    }

    if (body.action === "suspend_marketplace_collection") {
      const { data, error } = await supabaseAdmin
        .from("marketplace_collections")
        .update({ status: "suspended" })
        .eq("id", body.targetId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "marketplace_collection",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "marketplace_collection",
        targetId: body.targetId,
      });

      return NextResponse.json({ success: true, result: data });
    }

    if (body.action === "hide_listing" || body.action === "suspend_listing") {
      const nextSaleStatus = "hidden";
      const { data, error } = await supabaseAdmin
        .from("marketplace_listings")
        .update({ status: "suspended", sale_status: nextSaleStatus })
        .eq("id", body.targetId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "marketplace_listing",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "marketplace_listing",
        targetId: body.targetId,
        metadata: { nextStatus: "suspended", nextSaleStatus },
      });

      return NextResponse.json({ success: true, result: data });
    }

    if (body.action === "revalidate_listing_ownership") {
      const { data: listing, error } = await supabaseAdmin
        .from("marketplace_listings")
        .select("id, seller_wallet, mint_address, collection_type")
        .eq("id", body.targetId)
        .eq("source", "vertico_native")
        .single();

      if (error) throw new Error(error.message);

      const result = await revalidateNativeListingOwnership({
        listing,
        actorWallet: auth.wallet,
        writeReview: true,
      });

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "marketplace_listing",
        targetId: body.targetId,
        decision: body.action,
        notes: result.isCurrentOwner
          ? notes || "Seller still owns listed NFT"
          : notes || "Seller no longer owns listed NFT",
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "marketplace_listing",
        targetId: body.targetId,
        metadata: result,
      });

      return NextResponse.json({ success: true, result });
    }

    if (
      body.action === "review_report" ||
      body.action === "resolve_report" ||
      body.action === "dismiss_report"
    ) {
      const nextStatus =
        body.action === "review_report"
          ? "reviewing"
          : body.action === "resolve_report"
            ? "resolved"
            : "dismissed";
      const { data, error } = await supabaseAdmin
        .from("content_reports")
        .update({ status: nextStatus, admin_notes: notes })
        .eq("id", body.targetId)
        .select("*")
        .single();

      if (error) throw new Error(error.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "content_report",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: "content_report",
        targetId: body.targetId,
        metadata: { nextStatus },
      });

      return NextResponse.json({ success: true, result: data });
    }

    if (body.action === "suspend_report_target") {
      const { data: report, error: reportError } = await supabaseAdmin
        .from("content_reports")
        .select("*")
        .eq("id", body.targetId)
        .single();

      if (reportError) throw new Error(reportError.message);

      const table =
        report.target_type === "collection"
          ? "marketplace_collections"
          : "marketplace_listings";
      const update =
        report.target_type === "collection"
          ? { status: "suspended" }
          : { status: "suspended", sale_status: "hidden" };

      const { error: targetError } = await supabaseAdmin
        .from(table)
        .update(update)
        .eq("id", report.target_id);

      if (targetError) throw new Error(targetError.message);

      const { error: reportUpdateError } = await supabaseAdmin
        .from("content_reports")
        .update({ status: "reviewing", admin_notes: notes })
        .eq("id", body.targetId);

      if (reportUpdateError) throw new Error(reportUpdateError.message);

      await writeReview({
        adminWallet: auth.wallet,
        targetType: "content_report",
        targetId: body.targetId,
        decision: body.action,
        notes,
      });
      await writeAudit({
        adminWallet: auth.wallet,
        eventType: body.action,
        targetType: report.target_type,
        targetId: report.target_id,
        metadata: { reportId: report.id, update },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported admin action." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not perform marketplace admin action.",
      },
      { status: 500 }
    );
  }
}
