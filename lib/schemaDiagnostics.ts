import { createClient } from "@supabase/supabase-js";

export type DiagnosticStatus = "ok" | "warning" | "error";

export type DiagnosticCheck = {
  name: string;
  status: DiagnosticStatus;
  message: string;
};

type TableRequirement = {
  table: string;
  columns: string[];
};

const tableRequirements: TableRequirement[] = [
  {
    table: "creator_profiles",
    columns: [
      "wallet_address",
      "creator_status",
      "display_name",
      "bio",
      "website_url",
      "x_url",
      "created_at",
    ],
  },
  {
    table: "collection_submissions",
    columns: [
      "creator_id",
      "collection_name",
      "chain",
      "description",
      "status",
      "created_at",
    ],
  },
  {
    table: "marketplace_collections",
    columns: [
      "creator_id",
      "collection_name",
      "chain",
      "collection_address",
      "description",
      "preview_image_urls",
      "status",
      "created_at",
    ],
  },
  {
    table: "marketplace_listings",
    columns: [
      "source",
      "collection_type",
      "owner_wallet",
      "seller_wallet",
      "mint_address",
      "metadata_uri",
      "image_url",
      "attributes",
      "price_sol",
      "sale_status",
      "custody_status",
      "status",
    ],
  },
  {
    table: "content_reports",
    columns: ["target_type", "target_id", "reason", "details", "status"],
  },
  {
    table: "moderation_reviews",
    columns: ["admin_wallet", "target_type", "target_id", "decision", "notes"],
  },
  {
    table: "blocked_wallets",
    columns: ["wallet_address", "reason", "created_at"],
  },
  {
    table: "blocked_collections",
    columns: ["collection_address", "chain", "reason", "created_at"],
  },
  {
    table: "audit_logs",
    columns: [
      "actor_wallet",
      "event_type",
      "target_type",
      "target_id",
      "metadata",
      "created_at",
    ],
  },
];

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function missingColumnMessage(table: string, columns: string[], errorMessage: string) {
  const missingColumn = columns.find((column) =>
    errorMessage.toLowerCase().includes(column.toLowerCase())
  );

  if (missingColumn) {
    return `Error: ${table}.${missingColumn} column missing. Fix: run supabase/marketplace_schema.sql in Supabase SQL Editor.`;
  }

  return `Error: ${table} column check failed. Fix: run supabase/marketplace_schema.sql in Supabase SQL Editor. Expected columns: ${columns.join(", ")}.`;
}

export async function runMarketplaceSchemaDiagnostics(): Promise<
  DiagnosticCheck[]
> {
  const checks: DiagnosticCheck[] = [];
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [
      {
        name: "Marketplace Schema",
        status: "error",
        message:
          "Supabase admin client is not configured, so schema checks could not run.",
      },
    ];
  }

  for (const requirement of tableRequirements) {
    const { error } = await supabase
      .from(requirement.table)
      .select(requirement.columns.join(", "))
      .limit(1);

    if (error) {
      checks.push({
        name: `Schema: ${requirement.table}`,
        status: "error",
        message: missingColumnMessage(
          requirement.table,
          requirement.columns,
          error.message
        ),
      });
      console.error("Schema diagnostic failed", {
        table: requirement.table,
        columns: requirement.columns,
        error,
      });
      continue;
    }

    checks.push({
      name: `Schema: ${requirement.table}`,
      status: "ok",
      message: `${requirement.table} table and required columns are available.`,
    });
  }

  return checks;
}
