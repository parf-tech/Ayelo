// Types des requêtes et réponses de l'API v1 (alignés sur les contrôleurs du backend Laravel, routes sous /api/v1).
// Les formes de requête et de réponse sont dérivées du contrat généré (./openapi.d.ts, via ./generated).
// Là où le contrat reste trop large ou incomplet, le type est corrigé localement avec Refine ; les écarts connus
// sont signalés en commentaire. Les types que le contrat décrit mal (objets vides, énumérations en string, statuts omis)
// restent écrits à la main : `__tests__/apiTypes.test.ts` en garde la liste et la raison.
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
/**
 * GET /conversations : pagination par curseur optionnelle (`limit` 1-100, `cursor` opaque). La forme vient du contrat généré
 * (qui décrit `meta`) ; `meta` reste facultatif ici : un serveur plus ancien ne le renvoie pas, la liste est alors complète.
 */
export type ConversationListResponse = Refine<
  OpResponse<'conversation.index'>,
  { data: Conversation[]; meta?: OpResponse<'conversation.index'>['meta'] }
>;

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
export type ConsentsResponse = OpResponse<'account.consents'>; // objet indexé par type, seulement pour les types déjà décidés
export type ConsentState = NonNullable<ConsentsResponse['data'][ConsentKind]>;

export type DataExport = {
  id: string;
  status: 'pending' | 'ready' | 'expired' | 'failed';
  url?: string | null;
  expires_at?: string | null;
};

export type DeleteAccountResponse = OpResponse<'account.destroy', 202>;
/** Ré-authentification de DELETE /me et de POST /me/export : mot de passe, ou jeton du fournisseur (+ nonce facultatif). */
export type DeleteAccountRequest = OpRequest<'account.destroy'>;
export type ExportRequest = OpRequest<'account.requestExport'>;

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

type PublicProfileWire = OpResponse<'publicProfile.show'>;

/** Média d'un profil. `status` n'est renseigné que pour le propriétaire ; `url` est nulle tant que le média n'est pas lisible. */
export type ProfileMedia = Item<PublicProfileWire['media']>;
export type MediaStatus = NonNullable<ProfileMedia['status']>;
export type ProfileMediaKind = ProfileMedia['kind'];

/**
 * Types déposables via POST /media/upload-url : le backend n'ouvre que la photo de profil, l'image de message et le
 * selfie de vérification (config media.kinds). Vidéos et notes vocales restent fermées.
 */
export type UploadKind = OpRequest<'media.uploadUrl'>['kind'];

/** Profil public (autres utilisateurs). `last_seen_at` est absent quand la personne le masque. */
export type PublicProfile = PublicProfileWire;

type MeWire = OpResponse<'profile.me'>;

/** Profil du propriétaire (champ `profile` de GET /me, PUT /me/profile et PATCH /me/privacy) : s'y ajoutent confidentialité et vérification. */
export type SelfProfile = NonNullable<MeWire['profile']>;

export type Credits = MeWire['credits'];

/** GET /me. Le contrat type `email` comme nullable (compte sans e-mail) ; l'application attend toujours une adresse. */
export type Me = Refine<MeWire, { email: string }>;

/**
 * Réponse de PUT /me/profile (200 ou 201) et de PATCH /me/privacy : le serveur renvoie l'objet /me complet
 * (profil, crédits, premium), pas le seul profil. Même retouche d'`email` que `Me`.
 */
export type ProfileUpsertResponse = Refine<OpResponse<'profile.upsert'>, { email: string }>;
export type PrivacyUpdateResponse = Refine<OpResponse<'profile.privacy'>, { email: string }>;

/** Utilisateur de la session : { id, email, locale } après connexion, puis GET /me complet. */
export type AuthUser = User & Partial<Omit<Me, keyof User>>;

export type Preferences = OpResponse<'profile.preferences'>;

export type PrivacyInput = OpRequest<'profile.privacy'>;

export type UploadUrlRequest = OpRequest<'media.uploadUrl'>;
export type UploadUrlResponse = OpResponse<'media.uploadUrl', 201>;
export type MediaCompleteResponse = OpResponse<'media.complete'>;

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

/** Filtres de GET /discover. Les tableaux sont envoyés sous la forme countries[]=FR (le contrat les nomme `countries[]`). */
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

/** Réponse de GET /discover (opération `discovery` du contrat). */
export type DiscoverResponse = OpResponse<'discovery'>;

export type SwipeRequest = OpRequest<'swipe.store'>;
export type SwipeAction = SwipeRequest['action'];
/** 201 : swipe enregistré ; 200 : swipe déjà enregistré (rejeu). */
export type SwipeResult = OpResponse<'swipe.store', 201> | OpResponse<'swipe.store', 200>;
export type UndoSwipeResult = OpResponse<'swipe.undo'>;

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

/** `type` vaut « deleted » quand l'expéditeur a supprimé le message (contenu masqué). */
export type Message = Item<OpResponse<'message.index'>['data']> & {
  /** Renseigné sur la réponse d'envoi quand le serveur détecte une demande d'argent. */
  safety_hint?: NonNullable<OpResponse<'message.store', 201>['safety_hint']>;
};
export type MessageType = Message['type'];
/** Statut de modération de l'image d'un message : `processing` en revue humaine, `approved`, `rejected` ; null hors image. */
export type MessageMediaStatus = NonNullable<Message['media_status']>;
/** Adresse signée de l'image d'un message, valable jusqu'à `expires_at` (GET /conversations/{id}/messages/{messageId}/media). */
export type MessageMediaUrl = OpResponse<'message.media'>;

export type ConversationStatus = 'active' | 'blocked' | 'archived' | string;

type ConversationWire = Item<OpResponse<'conversation.index'>['data']>;

export type ConversationLastMessage = NonNullable<ConversationWire['last_message']>;

/** Le contrat de GET /conversations type `status` en string. */
export type Conversation = Refine<ConversationWire, { status: ConversationStatus }>;

/** 201 : conversation créée ; 200 : conversation déjà ouverte avec cette personne. */
export type OpenConversationResponse = OpResponse<'conversation.store', 201> | OpResponse<'conversation.store', 200>;

/** Le backend n'accepte que « text » et « image » à l'envoi (vidéos et notes vocales : spec 012). */
export type SendMessageRequest = OpRequest<'message.store'>;
export type SendableMessageType = SendMessageRequest['type'];

// ---- Appels -------------------------------------------------------------------------------------

export type CallKind = 'audio' | 'video';
export type LiveKitInfo = OpResponse<'call.token'>['livekit'];
export type CallStartResponse = {
  id: string;
  status: 'ringing' | 'busy';
  ring_seconds?: number;
  livekit?: LiveKitInfo;
};
export type CallAcceptResponse = OpResponse<'call.accept'>;
export type CallTokenResponse = OpResponse<'call.token'>;

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

/** PUT /me/device. Le contrat accepte aussi `null` pour effacer un jeton ; l'application n'envoie que des chaînes. */
export type DeviceRegistration = OpRequest<'device.update'>;
export type NotificationPrefs = {
  push_messages: boolean;
  push_matches: boolean;
  push_calls: boolean;
  push_marketing: boolean;
  email_marketing: boolean;
};
