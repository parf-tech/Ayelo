// Types des requêtes et réponses de l'API v1 (alignés sur les contrôleurs du backend Laravel, routes sous /api/v1).
// Les formes de requête et de réponse sont dérivées du contrat généré (./openapi.d.ts, via ./generated).
// Là où le contrat est trop large ou incomplet, le type est corrigé localement avec Refine ; les écarts connus
// sont signalés en commentaire. Les types sans opération dans le contrat restent écrits à la main.
import type { Item, OpRequest, OpResponse, Refine } from './generated';

export type Platform = OpRequest<'auth.login'>['platform'];
export type ApiLocale = NonNullable<OpRequest<'auth.register'>['locale']>;

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

type LoginWire = OpResponse<'auth.login'>;

export type User = Refine<LoginWire['user'], { email: string; locale: ApiLocale }>;

export type AgeCheckRequest = OpRequest<'auth.ageCheck'>; // birthdate : YYYY-MM-DD
export type AgeCheckResponse = Refine<OpResponse<'auth.ageCheck'>, { expires_in: number }>; // le contrat fige 600

export type ConsentsPayload = {
  terms: boolean;
  privacy: boolean;
  sensitive_data: boolean;
  marketing?: boolean;
};

/** Le contrat n'accepte que des consentements « vrais » ; l'application garde les booléens des cases à cocher. */
export type RegisterRequest = Refine<OpRequest<'auth.register'>, { consents: ConsentsPayload }>;

export type LoginRequest = OpRequest<'auth.login'>;

export type AuthResponse = Refine<LoginWire, { user: User }>;

export type OAuthProvider = 'google' | 'apple';

/** Le contrat type platform en string et ne prévoit pas de valeur nulle pour app_version, last_active_at, created_at. */
export type Session = Refine<
  Item<OpResponse<'session.index'>['data']>,
  { platform: Platform; app_version: string | null; last_active_at: string | null; created_at: string | null }
>;

export type ConsentKind = OpRequest<'account.consent'>['kind'];
export type ConsentUpdate = OpRequest<'account.consent'>;
// Le contrat décrit la réponse de GET /me/consents comme un tableau ; le serveur renvoie un objet indexé par type.
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

export type ProfileInput = OpRequest<'profile.upsert'>;
export type Gender = NonNullable<ProfileInput['gender']>;
export const GENDERS: readonly Gender[] = ['man', 'woman', 'other'];

export type Intent = NonNullable<ProfileInput['intent']>;
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

type PublicProfileWire = OpResponse<'publicProfile.show'>;

/**
 * Média d'un profil. `status` n'est renseigné que pour le propriétaire ; `url` est nulle tant que le média n'est pas lisible.
 * Le contrat type `kind` et `status` en string et `position` en string (le serveur envoie un entier).
 */
export type ProfileMedia = Refine<
  Item<PublicProfileWire['media']>,
  { kind: ProfileMediaKind; position: number; status: MediaStatus | null }
>;

/**
 * Profil public (autres utilisateurs). Le contrat type `age` en string (le serveur envoie un entier) et réduit
 * `gender` et `intent` à string ; `last_seen_at` reste facultatif côté application.
 */
export type PublicProfile = Refine<
  PublicProfileWire,
  { age: number; gender: Gender; intent: Intent; media: ProfileMedia[]; last_seen_at?: string | null }
>;

/** Profil du propriétaire (GET /me, PUT /me/profile). Le contrat omet les champs de confidentialité et de vérification. */
export type SelfProfile = PublicProfile & {
  is_visible: boolean;
  hide_distance: boolean;
  hide_last_seen: boolean;
  verification_status: VerificationStatus;
};

type MeWire = OpResponse<'profile.me'>;

export type Credits = MeWire['credits'];

/** GET /me. Le contrat type `age` en string et ne décrit pas les champs de confidentialité du profil. */
export type Me = Refine<MeWire, { email: string; locale: ApiLocale; age: number; profile: SelfProfile | null }>;

/** Utilisateur de la session : { id, email, locale } après connexion, puis GET /me complet. */
export type AuthUser = User & Partial<Omit<Me, keyof User>>;

/** Le contrat décrit les listes de GET /me/preferences en unknown[] et les nombres en string. */
export type Preferences = Refine<
  OpResponse<'profile.preferences'>,
  {
    seeking_genders: Gender[];
    age_min: number;
    age_max: number;
    countries: string[];
    origins: string[];
    intents: Intent[];
    max_distance_km: number | null;
  }
>;

export type PrivacyInput = OpRequest<'profile.privacy'>;

/** Le contrat ne liste que photo de profil, image de message et selfie ; l'application envoie aussi vidéos et notes vocales. */
export type UploadUrlRequest = Refine<OpRequest<'media.uploadUrl'>, { kind: UploadKind; duration_seconds?: number }>;
export type UploadUrlResponse = OpResponse<'media.uploadUrl', 201>;
export type MediaCompleteResponse = Refine<OpResponse<'media.complete'>, { status: MediaStatus }>;

export type VerificationPose = OpResponse<'verification.pose'>;
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
export type VerificationStartResponse = OpResponse<'verification.store', 201>;

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

export type SwipeRequest = OpRequest<'swipe.store'>;
export type SwipeAction = SwipeRequest['action'];
// Le contrat décrit la réponse de POST /swipes comme une chaîne : SwipeResult reste écrit à la main.
export type SwipeResult = {
  status: 'recorded' | 'already_swiped';
  matched: boolean;
  match_id?: string;
  conversation_id?: string;
};
export type UndoSwipeResult = OpResponse<'swipe.undo'>;

export type Match = Refine<Item<OpResponse<'match.index'>['data']>, { profile: PublicProfile | null }>;

export type Block = { user_id: string; display_name: string; created_at: string };

export type ReportRequest = OpRequest<'report.store'>;
export type ReportReason = ReportRequest['reason'];
export const REPORT_REASONS: readonly ReportReason[] = [
  'money_request',
  'harassment',
  'meeting_behavior',
  'fake_or_spam',
  'minor_suspected',
  'other',
];
export type ReportContextType = NonNullable<ReportRequest['context_type']>;
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

/** Le contrat type delivered_at et read_at en string (ils sont nuls tant que le message n'est ni remis ni lu). */
export type Message = Refine<
  Item<OpResponse<'message.index'>['data']>,
  { type: MessageType | string; delivered_at: string | null; read_at: string | null }
> & {
  /** Renseigné sur la réponse d'envoi quand le serveur détecte une demande d'argent. */
  safety_hint?: 'money_request' | string;
};

export type ConversationStatus = 'active' | 'blocked' | 'archived' | string;

type ConversationWire = Item<OpResponse<'conversation.index'>['data']>;

export type ConversationLastMessage = NonNullable<ConversationWire['last_message']>;

export type Conversation = Refine<
  ConversationWire,
  { status: ConversationStatus; last_message: ConversationLastMessage | null; profile: PublicProfile | null }
>;

// Le contrat annonce id: string | null à la création (201) ; l'application attend toujours un identifiant.
export type OpenConversationResponse = Refine<OpResponse<'conversation.store'>, { id: string; status: ConversationStatus }>;

/** Le contrat n'accepte que « text » et « image » ; l'application type aussi video et voice (SendableMessageType). */
export type SendMessageRequest = Refine<
  OpRequest<'message.store'>,
  { type: SendableMessageType; body?: string; media_id?: string }
>;

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
