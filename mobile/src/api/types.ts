// Types des requêtes et réponses de l'API v1 (alignés sur les contrôleurs du backend Laravel, routes sous /api/v1).
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
/** Liste sans curseur (le backend renvoie { data: [...] }). */
export type ListResponse<T> = { data: T[] };

// ---- Auth ---------------------------------------------------------------------------------------

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

export type OAuthProvider = 'google' | 'apple';

export type Session = {
  id: string;
  platform: Platform;
  app_version: string | null;
  last_active_at: string | null;
  created_at: string | null;
  current: boolean;
};

export type ConsentKind =
  | 'terms'
  | 'privacy'
  | 'sensitive_data'
  | 'marketing'
  | 'location'
  | 'verification_biometric';
export type ConsentUpdate = { kind: ConsentKind; version?: string; granted: boolean };
export type ConsentState = { granted: boolean; version: string; since: string };
export type ConsentsResponse = { data: Partial<Record<ConsentKind, ConsentState>> };

export type DataExport = {
  id: string;
  status: 'pending' | 'ready' | 'expired' | 'failed';
  url?: string | null;
  expires_at?: string | null;
};

export type DeleteAccountResponse = { status: 'scheduled'; purge_after_days: number };
export type DeleteAccountRequest = { password: string } | { provider: OAuthProvider; id_token: string };

// ---- Profil -------------------------------------------------------------------------------------

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

export type MediaStatus = 'pending_upload' | 'processing' | 'approved' | 'rejected';
export type ProfileMediaKind = 'profile_photo' | 'profile_video';
export type UploadKind =
  | ProfileMediaKind
  | 'message_image'
  | 'message_video'
  | 'message_voice'
  | 'verification_selfie';

/** Média d'un profil. `status` n'est renseigné que pour le propriétaire ; `url` est nulle tant que le média n'est pas lisible. */
export type ProfileMedia = {
  id: string;
  kind: ProfileMediaKind;
  position: number;
  status: MediaStatus | null;
  url: string | null;
};

/** Profil public (autres utilisateurs). */
export type PublicProfile = {
  user_id: string;
  display_name: string;
  age: number;
  gender: Gender;
  origin_country: string;
  residence_country: string;
  city: string | null;
  bio: string | null;
  intent: Intent;
  verified: boolean;
  media: ProfileMedia[];
  last_seen_at?: string | null;
};

/** Profil du propriétaire (GET /me, PUT /me/profile). */
export type SelfProfile = PublicProfile & {
  is_visible: boolean;
  hide_distance: boolean;
  hide_last_seen: boolean;
  verification_status: VerificationStatus;
};

export type Credits = { conversation: number; proposal: number; coin: number };

/** GET /me. */
export type Me = User & {
  email_verified: boolean;
  age: number;
  profile: SelfProfile | null;
  credits: Credits;
  premium: boolean;
};

/** Utilisateur de la session : { id, email, locale } après connexion, puis GET /me complet. */
export type AuthUser = User & Partial<Omit<Me, keyof User>>;

export type ProfileInput = Partial<
  Pick<SelfProfile, 'display_name' | 'gender' | 'origin_country' | 'residence_country' | 'city' | 'bio' | 'intent'>
>;

export type Preferences = {
  seeking_genders: Gender[];
  age_min: number;
  age_max: number;
  countries: string[];
  origins: string[];
  intents: Intent[];
  verified_only: boolean;
  max_distance_km: number | null;
};

export type PrivacyInput = Partial<Pick<SelfProfile, 'is_visible' | 'hide_distance' | 'hide_last_seen'>>;

export type UploadUrlRequest = {
  kind: UploadKind;
  mime_type: string;
  size_bytes: number;
  duration_seconds?: number;
};
export type UploadUrlResponse = {
  media_id: string;
  upload: { url: string; headers: Record<string, string> };
};
export type MediaCompleteResponse = { media_id: string; status: MediaStatus };

export type VerificationPose = { pose: string };
export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected';
export type VerificationOverview = {
  verification_status: VerificationStatus;
  last_request: {
    id: string;
    status: VerificationRequestStatus;
    reject_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
  } | null;
};
export type VerificationStartResponse = { id: string; status: 'pending' };

// ---- Découverte ---------------------------------------------------------------------------------

/** Filtres de GET /discover. Les tableaux sont envoyés sous la forme countries[]=FR. */
export type DiscoverFilters = {
  age_min?: number;
  age_max?: number;
  countries?: string[];
  origins?: string[];
  intents?: Intent[];
  verified_only?: boolean;
  cursor?: string;
  limit?: number;
};

export type SwipeAction = 'like' | 'dislike' | 'super_like';
export type SwipeResult = {
  status: 'recorded' | 'already_swiped';
  matched: boolean;
  match_id?: string;
  conversation_id?: string;
};
export type UndoSwipeResult = { target_id: string };

export type Match = {
  id: string;
  created_at: string;
  conversation_id: string | null;
  profile: PublicProfile | null;
};

export type Block = { user_id: string; display_name: string; created_at: string };

export type ReportReason =
  | 'money_request'
  | 'harassment'
  | 'meeting_behavior'
  | 'fake_or_spam'
  | 'minor_suspected'
  | 'other';
export const REPORT_REASONS: readonly ReportReason[] = [
  'money_request',
  'harassment',
  'meeting_behavior',
  'fake_or_spam',
  'minor_suspected',
  'other',
];
export type ReportContextType = 'profile' | 'conversation' | 'message' | 'call' | 'story';
export type ReportRequest = {
  reported_id: string;
  reason: ReportReason;
  details?: string;
  context_type?: ReportContextType;
  context_id?: string;
};
export type ReportResponse = { id?: string; status: 'received' | 'already_reported' };

export type Sanction = {
  id: string;
  kind: string;
  reason: string;
  starts_at: string | null;
  ends_at: string | null;
  appeal_status: string | null;
};

export type SupportTicket = { id: string; subject: string; status: string; created_at: string };
export type SupportTicketCreated = { id: string; status: string };

// ---- Messagerie ---------------------------------------------------------------------------------

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'call_missed' | 'deleted';
export type SendableMessageType = 'text' | 'image' | 'video' | 'voice';

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  client_id: string;
  type: MessageType | string;
  body: string | null;
  media_id: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  /** Renseigné sur la réponse d'envoi quand le serveur détecte une demande d'argent. */
  safety_hint?: 'money_request' | string;
};

export type ConversationStatus = 'active' | 'blocked' | 'archived' | string;

export type ConversationLastMessage = {
  id: string;
  mine: boolean;
  type: MessageType | string;
  body: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  status: ConversationStatus;
  unlocked_by: string;
  unread: number;
  last_message: ConversationLastMessage | null;
  profile: PublicProfile | null;
};

export type OpenConversationResponse = { id: string; status: ConversationStatus };

export type SendMessageRequest = {
  client_id: string;
  type: SendableMessageType;
  body?: string;
  media_id?: string;
};

// ---- Appels -------------------------------------------------------------------------------------

export type CallKind = 'audio' | 'video';
export type LiveKitInfo = { url: string; room: string; token: string };
export type CallStartResponse = {
  id: string;
  status: 'ringing' | 'busy';
  ring_seconds?: number;
  livekit?: LiveKitInfo;
};
export type CallAcceptResponse = { id: string; status: 'accepted'; livekit: LiveKitInfo };
export type CallTokenResponse = { livekit: LiveKitInfo };

// ---- Monétisation -------------------------------------------------------------------------------

export type BillingOffers = {
  subscriptions: { product_id: string; months: number }[];
  packs: { product_id: string; type: string; credits: number }[];
};
export type BillingStatus = {
  premium: boolean;
  subscription: { product_id: string; status: string; period_end: string; store: string } | null;
  credits: { conversation: number };
};
export type Transaction = {
  id: string;
  product_id: string;
  price_cents: number | null;
  currency: string | null;
  status: string;
  created_at: string;
};

// ---- Notifications ------------------------------------------------------------------------------

export type DeviceRegistration = { push_token?: string; voip_push_token?: string; app_version?: string };
export type NotificationPrefs = {
  push_messages: boolean;
  push_matches: boolean;
  push_calls: boolean;
  push_marketing: boolean;
  email_marketing: boolean;
};
