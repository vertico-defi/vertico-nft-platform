create extension if not exists pgcrypto;

create table if not exists creator_profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  email text not null,
  display_name text not null,
  country text not null,
  website_url text,
  x_url text,
  age_attested boolean not null default false,
  rights_attested boolean not null default false,
  identity_verification_status text not null default 'not_started'
    check (identity_verification_status in ('not_started', 'pending', 'verified', 'rejected')),
  creator_status text not null default 'pending'
    check (creator_status in ('pending', 'approved', 'rejected', 'suspended')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists collection_submissions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creator_profiles(id) on delete cascade,
  collection_name text not null,
  chain text not null,
  collection_address text,
  description text not null,
  preview_image_urls jsonb not null default '[]'::jsonb,
  metadata_sample_urls jsonb not null default '[]'::jsonb,
  rights_attestation boolean not null default false,
  consent_attestation boolean not null default false,
  adult_performer_attestation boolean not null default false,
  prohibited_content_attestation boolean not null default false,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketplace_collections (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references collection_submissions(id) on delete restrict,
  creator_id uuid not null references creator_profiles(id) on delete restrict,
  collection_name text not null,
  chain text not null,
  collection_address text,
  description text not null,
  preview_image_urls jsonb not null default '[]'::jsonb,
  status text not null default 'approved'
    check (status in ('approved', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  marketplace_collection_id uuid references marketplace_collections(id) on delete cascade,
  source text not null default 'external'
    check (source in ('vertico_native', 'external')),
  collection_type text
    check (collection_type is null or collection_type in ('pages', 'courtiers', 'royals')),
  owner_wallet text,
  seller_wallet text not null,
  mint_address text,
  metadata_uri text,
  name text not null,
  description text not null,
  image_url text,
  attributes jsonb not null default '[]'::jsonb,
  price_sol numeric,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'sold', 'suspended')),
  sale_status text not null default 'listed'
    check (sale_status in ('listed', 'sold', 'cancelled', 'hidden')),
  custody_status text not null default 'wallet_held'
    check (custody_status in ('wallet_held', 'escrowed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('collection', 'listing')),
  target_id uuid not null,
  reporter_wallet text,
  reason text not null,
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moderation_reviews (
  id uuid primary key default gen_random_uuid(),
  admin_wallet text not null,
  target_type text not null,
  target_id uuid not null,
  decision text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists blocked_wallets (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists blocked_collections (
  id uuid primary key default gen_random_uuid(),
  collection_address text not null unique,
  chain text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_wallet text,
  event_type text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists creator_profiles_updated_at on creator_profiles;
create trigger creator_profiles_updated_at
before update on creator_profiles
for each row execute function set_updated_at();

drop trigger if exists collection_submissions_updated_at on collection_submissions;
create trigger collection_submissions_updated_at
before update on collection_submissions
for each row execute function set_updated_at();

drop trigger if exists marketplace_collections_updated_at on marketplace_collections;
create trigger marketplace_collections_updated_at
before update on marketplace_collections
for each row execute function set_updated_at();

drop trigger if exists marketplace_listings_updated_at on marketplace_listings;
create trigger marketplace_listings_updated_at
before update on marketplace_listings
for each row execute function set_updated_at();

drop trigger if exists content_reports_updated_at on content_reports;
create trigger content_reports_updated_at
before update on content_reports
for each row execute function set_updated_at();

create index if not exists creator_profiles_wallet_address_idx on creator_profiles(wallet_address);
create index if not exists creator_profiles_creator_status_idx on creator_profiles(creator_status);
create index if not exists collection_submissions_creator_id_idx on collection_submissions(creator_id);
create index if not exists collection_submissions_status_idx on collection_submissions(status);
create index if not exists marketplace_collections_creator_id_idx on marketplace_collections(creator_id);
create index if not exists marketplace_collections_status_idx on marketplace_collections(status);
create index if not exists marketplace_listings_collection_id_idx on marketplace_listings(marketplace_collection_id);
create index if not exists marketplace_listings_status_idx on marketplace_listings(status);
create index if not exists marketplace_listings_source_idx on marketplace_listings(source);
create index if not exists marketplace_listings_seller_wallet_idx on marketplace_listings(seller_wallet);
create index if not exists marketplace_listings_mint_address_idx on marketplace_listings(mint_address);
create index if not exists marketplace_listings_sale_status_idx on marketplace_listings(sale_status);
create unique index if not exists marketplace_listings_active_mint_unique_idx
on marketplace_listings(mint_address)
where mint_address is not null and sale_status = 'listed';
create index if not exists content_reports_target_idx on content_reports(target_type, target_id);
create index if not exists content_reports_status_idx on content_reports(status);
create index if not exists moderation_reviews_target_idx on moderation_reviews(target_type, target_id);
create index if not exists audit_logs_target_idx on audit_logs(target_type, target_id);
create index if not exists audit_logs_event_type_idx on audit_logs(event_type);
