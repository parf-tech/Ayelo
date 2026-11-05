// Types des requêtes et réponses de l'API (docs/10-API-SPECIFICATIONS.md).
// Les formes marquées « provisoire » seront remplacées par le client généré depuis backend/openapi.yaml.

export type Platform = 'ios' | 'android';
export type ApiLocale = 'fr' | 'en';

/** Format d'erreur commun : { error: { code, message, fields? } }. */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
};

export type Page<T> = { data: T[]; next_cursor: string | null };
export type PageQuery = { cursor?: string; limit?: number };

// ---- Auth (implémenté côté backend) ----------------------------------------------------------

export type User = { id: string; email: string; locale: ApiLocale };

export type AgeCheckRequest = { birthdate: string }; // YYYY-MM-DD
export type AgeCheckResponse = { age_token: string; expires_in: number };

export type ConsentsPayload = {
  terms: boolean;
  privacy: boolean;
  sensitive_data: boolean;
  marketing?: boolean;
};

export type RegisterRequest = {
  email: string;
  password: string;
  age_token: string;
  platform: Platform;
  app_version?: string;
  locale?: ApiLocale;
  consents: ConsentsPayload;
};

export type LoginRequest = {
  email: string;
  password: string;
  platform: Platform;
  app_version?: string;
};

export type AuthResponse = { token: string; user: User };

/** GET /me : le backend renvoie pour l'instant { id, email, locale } ; les autres champs viendront (provisoire). */
export type Me = User & {
  profile?: Profile | null;
  preferences?: Preferences | null;
  premium?: { active: boolean; expires_at: string | null };
  balances?: { conversation_credits: number; gift_credits: number };
};

export type OAuthProvider = 'google' | 'apple' | 'tiktok';
export type OAuthRequest = {
  code?: string;
  id_token?: string;
  platform: Platform;
  age_token?: string;
  consents?: ConsentsPayload;
};

export type Session = {
  id: string;
  platform: Platform;
  app_version: string | null;
  last_active_at: string;
  current: boolean;
};

export type ConsentKind = 'terms' | 'privacy' | 'sensitive_data' | 'marketing' | 'location';
export type ConsentUpdate = { kind: ConsentKind; version: string; granted: boolean };

export type DataExport = {
  id: string;
  status: 'pending' | 'ready' | 'expired' | 'failed';
  url: string | null;
  expires_at: string | null;
};

// ---- Profil -----------------------------------------------------------------------------------

export type Gender = 'man' | 'woman' | 'other';
export const GENDERS: readonly Gender[] = ['man', 'woman', 'other'];

export type Intent = 'marriage' | 'long_lasting_love' | 'flirt' | 'friendship' | 'lets_find_out';
export const INTENTS: readonly Intent[] = [
  'marriage',
  'long_lasting_love',
  'flirt',
  'friendship',
  'lets_find_out',
];

export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type Profile = {
  display_name: string;
  gender: Gender;
  origin_country: string;
  residence_country: string;
  city: string | null;
  bio: string | null;
  intent: Intent;
  is_visible: boolean;
  hide_distance: boolean;
  hide_last_seen: boolean;
  verification_status: VerificationStatus;
};

export type ProfileInput = Partial<
  Pick<Profile, 'display_name' | 'gender' | 'origin_country' | 'residence_country' | 'city' | 'bio' | 'intent'>
>;

export type Preferences = {
  seeking_genders: Gender[];
  age_min: number;
  age_max: number;
  countries: string[];
  origins: string[];
  intents: Intent[];
};

export type PrivacyInput = Partial<Pick<Profile, 'is_visible' | 'hide_distance' | 'hide_last_seen'>>;

export type MediaKind = 'photo' | 'video' | 'voice' | 'image';
export type MediaStatus = 'pending_upload' | 'processing' | 'approved' | 'rejected';
export type Media = { id: string; kind: MediaKind; status: MediaStatus; url: string | null; position?: number };
export type UploadUrlRequest = { kind: MediaKind; mime: string; size: number };
export type UploadUrlResponse = {
  media_id: string;
  url: string;
  headers: Record<string, string>;
};

export type VerificationRequest = {
  id: string;
  status: VerificationStatus;
  reason: string | null;
};

export type PublicProfile = {
  id: string;
  display_name: string;
  age: number;
  city: string | null;
  residence_country: string;
  intent: Intent;
  bio: string | null;
  verified: boolean;
  photos: Media[];
};

// ---- Découverte -------------------------------------------------------------------------------

export type DiscoverFilters = {
  age_min?: number;
  age_max?: number;
  country?: string;
  origin?: string;
  intent?: Intent;
  verified_only?: boolean;
  cursor?: string;
};

export type SwipeAction = 'like' | 'dislike' | 'super_like';
export type SwipeResult = { matched: boolean; match?: Match };
export type Match = { id: string; profile: PublicProfile; conversation_id: string | null; created_at: string };

export type Block = { id: string; blocked: PublicProfile };

export type ReportReason = 'money_request' | 'harassment' | 'inappropriate_meeting' | 'fake_or_spam' | 'minor_suspected';
export type ReportRequest = {
  reported_id: string;
  reason: ReportReason;
  details?: string;
  context?: { kind: 'profile' | 'conversation' | 'call' | 'story'; id?: string };
};

export type Sanction = {
  id: string;
  kind: 'warning' | 'suspension' | 'ban';
  reason: string;
  ends_at: string | null;
  appealable: boolean;
};

export type SupportTicket = { id: string; subject: string; status: string; created_at: string };

// ---- Messagerie -------------------------------------------------------------------------------

export type MessageType = 'text' | 'image' | 'voice' | 'video' | 'gift' | 'system' | 'missed_call';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export type Message = {
  id: string;
  client_id: string;
  conversation_id: string;
  sender_id: string;
  type: MessageType;
  body: string | null;
  media: Media | null;
  status: MessageStatus;
  created_at: string;
};

export type Conversation = {
  id: string;
  peer: PublicProfile;
  last_message: Message | null;
  unread_count: number;
  status: 'active' | 'blocked' | 'archived';
};

export type SendMessageRequest = { client_id: string; type: MessageType; body?: string; media_id?: string };

// ---- Appels (phase D, client prêt, aucun écran) ----------------------------------------------

export type CallKind = 'audio' | 'video';
export type Call = { id: string; conversation_id: string; kind: CallKind; status: string };
export type CallWithToken = { call: Call; livekit_token: string };
export type LiveKitToken = { livekit_token: string; expires_in: number };

// ---- Contenus ---------------------------------------------------------------------------------

export type StoryVisibility = 'everyone' | 'matches' | 'list';
export type Story = { id: string; media: Media; created_at: string; expires_at: string; viewed: boolean };
export type StoryGroup = { author: PublicProfile; stories: Story[] };
export type StoryRequest = { media_id: string; visibility: StoryVisibility; audience?: string[] };
export type StoryViewer = { user: PublicProfile; reaction: string | null; viewed_at: string };

export type Invite = {
  id: string;
  author: PublicProfile;
  media: Media;
  title: string;
  activity: string;
  city: string;
  starts_at: string;
};
export type InviteRequest = { media_id: string; title: string; activity: string; city: string; starts_at: string };

// ---- Monétisation -----------------------------------------------------------------------------

export type BillingOffers = {
  plans: { id: string; months: 1 | 3 | 12; price: string; product_id: string }[];
  credit_packs: { id: string; credits: number; price: string; product_id: string }[];
};
export type BillingStatus = {
  premium: { active: boolean; expires_at: string | null; auto_renew: boolean };
  balances: { conversation_credits: number; gift_credits: number };
};
export type Transaction = { id: string; kind: string; amount: string; created_at: string };
export type Gift = { id: string; name: string; price_credits: number; animation: string };
export type GiftSendRequest = { conversation_id: string; gift_id: string };
export type GiftSendResponse = { message: Message; balance: number };

// ---- Notifications ----------------------------------------------------------------------------

export type DeviceRegistration = { platform: Platform; push_token: string; app_version: string };
export type NotificationPrefs = Record<string, boolean>;
