-- Schéma PostgreSQL 16 : clone Chat&Yamo (V1)
-- Accès : contrôles d'autorisation dans la couche données (pas de RLS, pas de Supabase).
-- Heures en timestamptz (UTC). Argent en cents + devise.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- email insensible à la casse

-- ---------- enums ----------
create type intent_kind as enum ('marriage','long_lasting_love','flirt','friendship','lets_find_out');
create type auth_provider as enum ('email','google','apple','tiktok');
create type media_kind as enum ('profile_photo','profile_video','invite_video');
create type media_status as enum ('pending_upload','processing','approved','rejected');
create type report_reason as enum ('money_request','harassment','meeting_behavior','fake_or_spam');
create type report_status as enum ('open','reviewed','actioned','dismissed');
create type store_kind as enum ('apple','google');

-- ---------- users / auth ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  password_hash text,                              -- null si login social
  status text not null default 'active'
    check (status in ('active','suspended','deleted')),
  is_admin boolean not null default false,
  conversation_credits integer not null default 0 check (conversation_credits >= 0),
  proposal_credits integer not null default 0 check (proposal_credits >= 0),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider auth_provider not null,
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index on auth_identities (user_id);

create table refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on refresh_tokens (user_id);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on push_tokens (user_id);

-- ---------- profils ----------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  gender text not null check (gender in ('man','woman','other')),
  looking_for text[] not null default '{}',
  origin_country char(2) not null,                 -- ISO 3166-1 alpha-2
  residence_country char(2) not null,
  city text,
  bio text check (char_length(bio) <= 500),
  intent intent_kind not null,
  is_visible boolean not null default true,        -- toggle "Show my profile"
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (origin_country);
create index on profiles (residence_country);
create index on profiles (intent);
create index on profiles (is_visible, is_verified);

create table media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind media_kind not null,
  status media_status not null default 'pending_upload',
  r2_key text not null unique,
  mime_type text not null,
  size_bytes bigint check (size_bytes > 0),
  duration_seconds integer check (duration_seconds > 0 and duration_seconds <= 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on media (user_id, kind);
create index on media (status);

-- ---------- invitations vidéo ----------
create table video_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  activity text not null check (activity in ('movie','concert','dinner','outing','other')),
  city text,
  event_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on video_invites (user_id);
create index on video_invites (status, created_at desc);

-- ---------- chat ----------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  initiated_by uuid not null references users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a <> user_b),
  check (user_a < user_b)                           -- ordre canonique : une seule ligne par paire
);
create unique index on conversations (user_a, user_b);
create index on conversations (user_b);
create index on conversations (last_message_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  client_id uuid not null,                          -- idempotence : renvoi sans doublon
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, client_id)
);
create index on messages (conversation_id, created_at desc);
create index on messages (sender_id);

-- ---------- sécurité ----------
create table blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique (blocker_id, blocked_id)
);
create index on blocks (blocked_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id) on delete cascade,
  reported_id uuid not null references users(id) on delete cascade,
  reason report_reason not null,
  details text check (char_length(details) <= 1000),
  status report_status not null default 'open',
  outcome text check (outcome in ('warning','suspension','ban')),
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index on reports (reported_id);
create index on reports (reporter_id);
create index on reports (status, created_at);

-- ---------- paiements (RevenueCat = source de vérité) ----------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  store store_kind not null,
  product_id text not null,                         -- ex. premium_1m, premium_6m, premium_12m
  status text not null check (status in ('active','grace','expired','cancelled','refunded')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  revenuecat_app_user_id text not null,
  original_transaction_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index on subscriptions (user_id, status);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  store store_kind not null,
  product_id text not null,                         -- conversation_pack, proposals_pack
  credits_granted integer not null check (credits_granted > 0),
  price_cents integer check (price_cents >= 0),
  currency char(3),
  transaction_id text not null unique,              -- idempotence des webhooks
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on purchases (user_id);

create table webhook_events (
  id text primary key,                              -- event id RevenueCat (idempotence)
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
