-- 001_initial.sql : schéma de référence PostgreSQL 16 (phases A, B, D, E ; stories en C incluses pour éviter une refonte)
-- Source de vérité : ce fichier. Les documents 08, 09 et 10 s'alignent dessus.
-- Extensions : citext uniquement (gen_random_uuid() est natif depuis PostgreSQL 13).
-- La proximité (PostGIS) est hors de cette migration : migration séparée "00X_proximity.sql" en phase E.
-- Convention : enums remplacés par text + check (migration plus simple). Heures en timestamptz (UTC).
-- Laravel : clés uuid ordonnées côté application (HasUuids), colonne mot de passe nommée `password`.

create extension if not exists citext;

-- ---------- personnel d'administration (séparé des utilisateurs) ----------
create table staff_users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password text not null,
  role text not null check (role in ('moderator','support','admin')),
  totp_secret_encrypted text,                     -- 2FA obligatoire : doit être renseigné avant la première session
  recovery_codes_encrypted text,
  is_active boolean not null default true,        -- on désactive, on ne supprime jamais (audit)
  last_login_at timestamptz,
  locale text check (locale in ('fr','en')),      -- langue du back-office choisie par la personne ; nul = ADMIN_LOCALE
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- comptes ----------
create table users (
  id uuid primary key default gen_random_uuid(),
  email citext unique,
  email_verified_at timestamptz,
  phone text unique,
  phone_verified_at timestamptz,
  password text,                                   -- null si connexion sociale
  birthdate date not null check (birthdate <= current_date - interval '18 years'),  -- fixée à la création du compte (jeton de contrôle d'âge), non modifiable
  locale text not null default 'fr' check (locale in ('fr','en')),
  status text not null default 'active'
    check (status in ('active','suspended','banned','deleting','deleted')),
  risk_score smallint not null default 0 check (risk_score between 0 and 100),
  last_seen_at timestamptz,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index users_active_birthdate_idx on users (birthdate) where status = 'active';   -- découverte : filtre d'âge
create index users_active_last_seen_idx on users (last_seen_at) where status = 'active';  -- découverte : filtre de fraîcheur

create table user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('terms','privacy','sensitive_data','location','marketing','verification_biometric')),
  version text not null,
  granted boolean not null,
  ip inet,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on user_consents (user_id, kind, created_at desc);

create table auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('google','apple','tiktok')),
  provider_user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index on auth_identities (user_id);

create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_id bigint,                                 -- id du jeton Sanctum associé (liste des sessions)
  platform text not null check (platform in ('ios','android')),
  push_token text unique,                          -- upsert : un jeton qui change de compte est réaffecté
  voip_push_token text,                            -- iOS PushKit (appels)
  device_fingerprint_hash text,
  app_version text,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on devices (user_id);
create index on devices (device_fingerprint_hash);

create table verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('email','phone','password_reset','account_deletion')),
  code_hash text not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on verification_codes (user_id, channel);

-- Refus d'âge et bannissements : conservés après suppression de compte (hash uniquement)
create table banned_identifiers (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email','phone','device','oauth','age_refusal')),
  value_hash text not null,
  reason text not null,
  expires_at timestamptz,                          -- null = permanent
  created_at timestamptz not null default now(),
  unique (kind, value_hash)
);

create table notification_prefs (
  user_id uuid primary key references users(id) on delete cascade,
  push_messages boolean not null default true,
  push_matches boolean not null default true,
  push_calls boolean not null default true,
  push_marketing boolean not null default false,
  email_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profils ----------
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  gender text not null check (gender in ('man','woman','other')),
  origin_country char(2) not null,
  residence_country char(2) not null,
  city text,
  bio text check (char_length(bio) <= 500),
  intent text not null check (intent in ('marriage','long_lasting_love','flirt','friendship','lets_find_out')),
  is_visible boolean not null default true,
  hide_distance boolean not null default false,
  hide_last_seen boolean not null default false,
  verification_status text not null default 'none'
    check (verification_status in ('none','pending','verified','rejected')),
  residence_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on profiles (origin_country);
create index on profiles (residence_country);
create index on profiles (intent);
create index on profiles (is_visible, verification_status);
create index profiles_visible_created_idx on profiles (created_at desc, id desc) where is_visible;  -- tri de la découverte

create table preferences (
  user_id uuid primary key references users(id) on delete cascade,
  seeking_genders text[] not null default '{}',
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null default 99,
  countries char(2)[] not null default '{}',
  origins char(2)[] not null default '{}',
  intents text[] not null default '{}',
  verified_only boolean not null default false,
  max_distance_km integer check (max_distance_km > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_max >= age_min)
);

create table media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('profile_photo','profile_video','message_image','message_video','message_voice','story','invite_video','verification_selfie')),
  status text not null default 'pending_upload'
    check (status in ('pending_upload','transcoding','processing','approved','rejected','purged')),  -- transcoding : notes vocales et vidéos, avant la revue humaine
  storage_key text not null unique,
  mime_type text not null,
  size_bytes bigint check (size_bytes > 0),
  duration_seconds integer check (duration_seconds > 0),
  position smallint not null default 0 check (position between 0 and 11),  -- 6 photos max (appli) ; 6..11 = positions temporaires pour réordonner
  moderation_label text,
  moderated_by uuid references staff_users(id) on delete set null,
  purge_after timestamptz,                         -- selfie de vérification : supprimé après décision
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on media (user_id, kind);
create index media_approved_photo_idx on media (user_id) where kind = 'profile_photo' and status = 'approved';  -- découverte : photo approuvée
create index on media (status, created_at);
create unique index media_photo_position_unique on media (user_id, position)
  where kind = 'profile_photo' and status in ('pending_upload','processing','approved');

create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  selfie_media_id uuid not null references media(id) on delete cascade,
  pose_code text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reject_reason text,
  reviewed_by uuid references staff_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on verification_requests (user_id);
create index on verification_requests (selfie_media_id);
create index on verification_requests (status, created_at);

-- ---------- découverte ----------
create table swipes (
  id uuid primary key default gen_random_uuid(),
  swiper_id uuid not null references users(id) on delete cascade,
  target_id uuid not null references users(id) on delete cascade,
  action text not null check (action in ('like','dislike','super_like')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (swiper_id <> target_id),
  unique (swiper_id, target_id)
);
create index on swipes (target_id, action);
create index on swipes (swiper_id, created_at desc);

create table matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','unmatched','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index on matches (user_b);

-- compteurs journaliers (quota de likes, nouvelles conversations, SMS)
create table daily_counters (
  user_id uuid not null references users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('likes','super_likes','new_conversations','sms','report')),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day, kind)
);

-- ---------- messagerie et appels ----------
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references users(id) on delete cascade,
  user_b uuid not null references users(id) on delete cascade,
  match_id uuid references matches(id) on delete set null,
  initiated_by uuid not null references users(id) on delete cascade,
  unlocked_by text not null check (unlocked_by in ('match','premium','credit','free')),
  status text not null default 'active' check (status in ('active','blocked','archived')),
  hidden_by_a_at timestamptz,                      -- « supprimée » côté A, conservée pour modération
  hidden_by_b_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
create index on conversations (user_b);
create index on conversations (match_id) where match_id is not null;
create index on conversations (initiated_by);
create index on conversations (last_message_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id) on delete cascade,
  client_id uuid not null,
  type text not null check (type in ('text','image','video','voice','gift','call_missed','system')),
  body text check (char_length(body) <= 2000),
  media_id uuid references media(id) on delete set null,
  delivered_at timestamptz,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, sender_id, client_id),
  check (type <> 'text' or deleted_at is not null or (body is not null and char_length(body) >= 1))
);
-- Index des chemins chauds (revue CTO 1, risque 9). Migration miroir : 2026_11_08_000000_add_hot_path_indexes.php, qui
-- les crée avec `create index concurrently` sur une base déjà en production (ne bloque pas les écritures).
create index messages_conversation_created_idx on messages (conversation_id, created_at desc, id desc);  -- curseur et dernier message
create index messages_unread_idx on messages (conversation_id) where read_at is null and deleted_at is null;  -- non lus
create index on messages (sender_id);
create index on messages (media_id) where media_id is not null;

create table call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  caller_id uuid not null references users(id) on delete cascade,
  callee_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('audio','video')),
  status text not null default 'ringing'
    check (status in ('ringing','accepted','declined','missed','busy','ended','failed')),
  livekit_room text not null unique,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (caller_id <> callee_id)
);
create index on call_sessions (conversation_id, created_at desc);
create index on call_sessions (callee_id, status);
create index on call_sessions (caller_id);

-- ---------- contenus ----------
create table stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  visibility text not null default 'matches' check (visibility in ('everyone','matches','custom')),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on stories (user_id, expires_at);
create index on stories (expires_at);
create index on stories (media_id);

create table story_audience (
  story_id uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  primary key (story_id, viewer_id)
);
create index on story_audience (viewer_id);

create table story_views (
  story_id uuid not null references stories(id) on delete cascade,
  viewer_id uuid not null references users(id) on delete cascade,
  reaction text,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);
create index on story_views (viewer_id);

create table video_invites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  activity text not null check (activity in ('movie','concert','dinner','outing','other')),
  city text,
  country char(2) not null,
  event_at timestamptz,
  status text not null default 'active' check (status in ('active','expired','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on video_invites (user_id);
create index on video_invites (media_id);
create index on video_invites (country, status, created_at desc);

-- ---------- monétisation ----------
-- app_user_id RevenueCat = users.id
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  store text not null check (store in ('apple','google','promotional')),
  product_id text not null,
  status text not null check (status in ('active','grace','expired','cancelled','refunded')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  original_transaction_id text unique,             -- null pour un Premium offert par l'administration
  granted_by uuid references staff_users(id) on delete set null,
  last_event_ms bigint,                              -- event_timestamp_ms RevenueCat du dernier événement appliqué (revue F-13)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (store <> 'promotional' or original_transaction_id is null),
  check (store = 'promotional' or original_transaction_id is not null)
);
create index on subscriptions (user_id, status);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  credit_type text not null check (credit_type in ('conversation','proposal','coin')),
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('purchase','refund_reversal','spend_conversation','spend_proposal','spend_gift','admin_adjust','promo','referral')),
  ref_type text,
  ref_id uuid,
  idempotency_key text not null,
  note text,
  created_by uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index on credit_ledger (user_id, credit_type, created_at desc);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  store text not null check (store in ('apple','google')),
  product_id text not null,
  price_cents integer check (price_cents >= 0),
  currency char(3),
  transaction_id text not null unique,
  status text not null default 'completed' check (status in ('pending','completed','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on purchases (user_id);

create table gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_coins integer not null check (price_coins > 0),
  animation_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table gift_sends (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references gifts(id) on delete restrict,
  sender_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  price_coins integer not null check (price_coins > 0),
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (sender_id, idempotency_key),
  check (sender_id <> receiver_id)
);
create index on gift_sends (receiver_id);
create index on gift_sends (gift_id);
create index on gift_sends (conversation_id);

create table webhook_events (
  id text primary key,                             -- id d'événement RevenueCat (idempotence)
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- ---------- sécurité, conformité, support ----------
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

-- Les signalements et sanctions survivent à la suppression du compte (anonymisation, pas de delete en cascade)
create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references users(id) on delete set null,
  reported_id uuid not null references users(id) on delete restrict,
  reason text not null check (reason in ('money_request','harassment','meeting_behavior','fake_or_spam','minor_suspected','other')),
  details text check (char_length(details) <= 1000),
  context_type text,
  context_id uuid,
  priority smallint not null default 0 check (priority between 0 and 2),
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  outcome text check (outcome in ('warning','suspension','ban','none')),
  reviewed_by uuid references staff_users(id) on delete set null,
  reviewed_at timestamptz,
  assigned_to uuid references staff_users(id) on delete set null,  -- « Prendre » : verrou de décision, expire (admin.assignment_ttl_minutes)
  assigned_at timestamptz,
  evidence_retain_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id is null or reporter_id <> reported_id)
);
create index on reports (reported_id);
create index on reports (reporter_id);
create index on reports (status, priority desc, created_at);
create index reports_assigned_to_idx on reports (assigned_to) where assigned_to is not null;

create table risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  signal text not null,
  weight smallint not null,
  details jsonb,
  created_at timestamptz not null default now()
);
create index on risk_events (user_id, created_at desc);

create table sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete restrict,
  kind text not null check (kind in ('warning','suspension','ban')),
  reason text not null,
  report_id uuid references reports(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index on sanctions (user_id);
create index on sanctions (report_id) where report_id is not null;

create table appeals (
  id uuid primary key default gen_random_uuid(),
  sanction_id uuid not null references sanctions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  reviewed_by uuid references staff_users(id) on delete set null,
  reviewed_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sanction_id)
);
create index on appeals (status, created_at);
create index on appeals (user_id);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subject text not null check (char_length(subject) between 3 and 120),
  body text not null check (char_length(body) between 5 and 4000),
  status text not null default 'open' check (status in ('open','pending','closed')),
  assigned_to uuid references staff_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on support_tickets (user_id);
create index on support_tickets (status, created_at);

create table data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','ready','expired','failed')),
  storage_key text unique,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on data_exports (user_id);

-- ---------- journal d'audit (ajout seulement) ----------
create table audit_logs (
  id bigint generated always as identity primary key,
  actor_staff_id uuid references staff_users(id) on delete restrict,
  action text not null,
  subject_type text,
  subject_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index on audit_logs (actor_staff_id, created_at desc);
create index on audit_logs (subject_type, subject_id);

create or replace function forbid_change() returns trigger language plpgsql as $$
begin
  raise exception 'table % is append-only', tg_table_name;
end $$;

create trigger audit_logs_append_only before update or delete on audit_logs
  for each row execute function forbid_change();
create trigger audit_logs_no_truncate before truncate on audit_logs
  for each statement execute function forbid_change();

-- date de naissance non modifiable après création (seule exception : l'anonymisation, qui la ramène au 1er janvier de la même année ; revue F-06)
create or replace function lock_birthdate() returns trigger language plpgsql as $$
begin
  if new.birthdate is distinct from old.birthdate then
    if new.status = 'deleted' and old.status is distinct from 'deleted'
       and new.birthdate = date_trunc('year', old.birthdate)::date then
      return new;
    end if;
    raise exception 'birthdate cannot be changed';
  end if;
  return new;
end $$;

create trigger users_lock_birthdate before update on users
  for each row execute function lock_birthdate();

-- adresses en rebond définitif ou en plainte (webhooks du prestataire d'e-mail) : plus aucun e-mail de compte ne leur est envoyé.
-- Pas de clé étrangère : la suppression survit à l'effacement du compte. Migration miroir : 2026_11_09_000000_create_email_suppressions.php
create table email_suppressions (
  email citext primary key,
  reason text not null check (reason in ('hard_bounce','complaint')),
  provider text not null,
  created_at timestamptz not null default now()
);

-- textes des mentions légales du site de présentation, saisis depuis le panneau d'administration (page « Mentions légales »).
-- Une ligne par champ et par langue : `draft` = texte en attente de publication (null = aucun brouillon, '' = effacement en attente),
-- `published` = texte affiché sur le site (null = marqueur « À COMPLÉTER » conservé). Les clés viennent de web/tools/legal-slots.json.
-- Migration miroir : 2026_11_20_000000_create_site_legal.php
create table site_legal_fields (
  key text not null,
  lang text not null check (lang in ('fr','en')),
  draft text,
  published text,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (key, lang)
);

-- réglages du site de présentation : `banner_visible` = '1' / '0' (absent = bannière « version provisoire » affichée).
create table site_legal_settings (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
