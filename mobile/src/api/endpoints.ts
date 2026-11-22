import type { ApiClient } from './client';
import type { OpRequest, Refine } from './generated';
import type {
  AgeCheckResponse,
  AuthResponse,
  Block,
  BillingOffers,
  BillingStatus,
  CallAcceptResponse,
  CallKind,
  CallStartResponse,
  CallTokenResponse,
  ConsentUpdate,
  ConsentsResponse,
  ConversationListResponse,
  DataExport,
  DeleteAccountRequest,
  DeleteAccountResponse,
  DeviceRegistration,
  DiscoverFilters,
  DiscoverResponse,
  ExportRequest,
  ListResponse,
  LoginRequest,
  Me,
  MediaCompleteResponse,
  Message,
  NotificationPrefs,
  OAuthProvider,
  OpenConversationResponse,
  Page,
  PageQuery,
  Preferences,
  PrivacyInput,
  PrivacyUpdateResponse,
  ProfileInput,
  ProfileUpsertResponse,
  PublicProfile,
  RegisterRequest,
  ReportRequest,
  ReportResponse,
  Sanction,
  SendMessageRequest,
  Session,
  SupportTicket,
  SupportTicketCreated,
  SwipeAction,
  SwipeRequest,
  SwipeResult,
  Transaction,
  UndoSwipeResult,
  UploadUrlRequest,
  UploadUrlResponse,
  VerificationOverview,
  VerificationPose,
  VerificationStartResponse,
} from './types';

/**
 * Routes de l'API v1 réellement exposées par le backend (backend/routes/api/*.php).
 * Aucune route n'est inventée : tout ce qui n'existe pas côté serveur est absent d'ici.
 */
export function createEndpoints(client: ApiClient) {
  const { request } = client;

  const auth = {
    /** Contrôle d'âge AVANT création du compte. 403 { code: 'age_not_eligible' } = refus. */
    ageCheck: (birthdate: string) =>
      request<AgeCheckResponse>('POST', '/auth/age-check', { auth: false, body: { birthdate } satisfies OpRequest<'auth.ageCheck'> }),
    register: (body: RegisterRequest) =>
      request<AuthResponse>('POST', '/auth/register', { auth: false, body }),
    login: (body: LoginRequest) => request<AuthResponse>('POST', '/auth/login', { auth: false, body }),
    logout: () => request<void>('POST', '/auth/logout'),
    me: () => request<Me>('GET', '/me'),

    /** `nonce` : valeur BRUTE (le serveur accepte aussi son SHA-256), revue F-21 / P-06. */
    oauth: (provider: OAuthProvider, body: Refine<OpRequest<'auth.oAuth'>, { platform: string; age_token?: string }>) =>
      request<AuthResponse>('POST', `/auth/oauth/${provider}`, { auth: false, body }),
    /** Lien reçu par e-mail : { token }. 422 invalid_token si le lien est expiré. */
    verifyEmail: (token: string) => request<void>('POST', '/auth/email/verify', { auth: false, body: { token } satisfies OpRequest<'emailVerification.verify'> }),
    resendEmail: () => request<void>('POST', '/auth/email/resend'),
    forgotPassword: (email: string) =>
      request<void>('POST', '/auth/password/forgot', { auth: false, body: { email } satisfies OpRequest<'password.forgot'> }),
    resetPassword: (token: string, password: string) =>
      request<void>('POST', '/auth/password/reset', { auth: false, body: { token, password } satisfies OpRequest<'password.reset'> }),
    sessions: () => request<ListResponse<Session>>('GET', '/auth/sessions'),
    closeSession: (id: string) => request<void>('DELETE', `/auth/sessions/${id}`),
    closeAllSessions: () => request<void>('DELETE', '/auth/sessions'),

    consents: () => request<ConsentsResponse>('GET', '/me/consents'),
    updateConsent: (body: ConsentUpdate) => request<void>('POST', '/me/consents', { body }),
    /** Ré-authentification : mot de passe, ou { provider, id_token } pour un compte social. */
    deleteAccount: (body: DeleteAccountRequest) => request<DeleteAccountResponse>('DELETE', '/me', { body }),
    requestExport: (body: ExportRequest) => request<DataExport>('POST', '/me/export', { body }),
    getExport: (id: string) => request<DataExport>('GET', `/me/export/${id}`),
  };

  const profile = {
    /** Création (201) ou mise à jour (200) ; à la création tous les champs sont obligatoires. Renvoie l'objet /me complet. */
    update: (body: ProfileInput) => request<ProfileUpsertResponse>('PUT', '/me/profile', { body }),
    preferences: () => request<Preferences>('GET', '/me/preferences'),
    updatePreferences: (body: Partial<Preferences>) => request<Preferences>('PUT', '/me/preferences', { body }),
    /** Renvoie l'objet /me complet (profil mis à jour, crédits, premium), comme GET /me. */
    updatePrivacy: (body: PrivacyInput) => request<PrivacyUpdateResponse>('PATCH', '/me/privacy', { body }),
    /** Battement de présence (FR-D-4) : à envoyer environ une fois par minute, application au premier plan. */
    heartbeat: () => request<void>('POST', '/me/presence'),
    createUploadUrl: (body: UploadUrlRequest) => request<UploadUrlResponse>('POST', '/media/upload-url', { body }),
    completeUpload: (mediaId: string) => request<MediaCompleteResponse>('POST', `/media/${mediaId}/complete`),
    orderMedia: (ids: string[]) => request<{ ids: string[] }>('PUT', '/me/media/order', { body: { ids } }),
    deleteMedia: (mediaId: string) => request<void>('DELETE', `/media/${mediaId}`),
    pose: () => request<VerificationPose>('GET', '/me/verification/pose'),
    verification: () => request<VerificationOverview>('GET', '/me/verification'),
    startVerification: (selfieMediaId: string) =>
      request<VerificationStartResponse>('POST', '/me/verification', { body: { selfie_media_id: selfieMediaId } satisfies OpRequest<'verification.store'> }),
    publicProfile: (id: string) => request<PublicProfile>('GET', `/profiles/${id}`),
  };

  const discovery = {
    discover: (filters: DiscoverFilters = {}) =>
      request<DiscoverResponse>('GET', '/discover', { query: { ...filters } }),
    /** 402 premium_required (super like), 429 quota_reached. */
    swipe: (targetId: string, action: SwipeAction) =>
      request<SwipeResult>('POST', '/swipes', { body: { target_id: targetId, action } satisfies SwipeRequest }),
    /** Premium uniquement (402 premium_required) ; 409 nothing_to_undo. */
    undoSwipe: () => request<UndoSwipeResult>('POST', '/swipes/undo'),
    /** `id` = `match_id` d'un élément de GET /conversations (la liste GET /matches n'est pas utilisée : plafonnée à 100, sans curseur). */
    deleteMatch: (id: string) => request<void>('DELETE', `/matches/${id}`),
  };

  const safety = {
    block: (blockedId: string) => request<void>('POST', '/blocks', { body: { blocked_id: blockedId } }),
    unblock: (userId: string) => request<void>('DELETE', `/blocks/${userId}`),
    blocks: () => request<ListResponse<Block>>('GET', '/blocks'),
    report: (body: ReportRequest) => request<ReportResponse>('POST', '/reports', { body }),
    sanctions: () => request<ListResponse<Sanction>>('GET', '/me/sanctions'),
    appeal: (sanctionId: string, message: string) =>
      request<{ id: string; status: string }>('POST', '/appeals', { body: { sanction_id: sanctionId, message } }),
    createSupportTicket: (subject: string, body: string) =>
      request<SupportTicketCreated>('POST', '/support/tickets', { body: { subject, body } }),
    supportTickets: () => request<ListResponse<SupportTicket>>('GET', '/support/tickets'),
  };

  const messaging = {
    /** Sans paramètre : jusqu'à 100 conversations. `meta.next_cursor` non nul : page suivante via `cursor`. */
    conversations: (page: PageQuery = {}) =>
      request<ConversationListResponse>('GET', '/conversations', { query: { ...page } }),
    /** 402 credit_required si ni Premium ni crédit « Conversation ». */
    openConversation: (targetId: string) =>
      request<OpenConversationResponse>('POST', '/conversations', { body: { target_id: targetId } satisfies OpRequest<'conversation.store'> }),
    messages: (conversationId: string, page: PageQuery = {}) =>
      request<Page<Message>>('GET', `/conversations/${conversationId}/messages`, { query: { ...page } }),
    /** Idempotent par client_id : renvoyer le même client_id ne crée pas de doublon. */
    sendMessage: (conversationId: string, body: SendMessageRequest) =>
      request<Message>('POST', `/conversations/${conversationId}/messages`, { body }),
    markRead: (conversationId: string, upToMessageId: string) =>
      request<void>('POST', `/conversations/${conversationId}/read`, { body: { up_to_message_id: upToMessageId } }),
    markDelivered: (conversationId: string, upToMessageId: string) =>
      request<void>('POST', `/conversations/${conversationId}/delivered`, {
        body: { up_to_message_id: upToMessageId },
      }),
    hideConversation: (conversationId: string) => request<void>('POST', `/conversations/${conversationId}/hide`),
    typing: (conversationId: string) => request<void>('POST', `/conversations/${conversationId}/typing`),
    deleteMessage: (messageId: string) => request<void>('DELETE', `/messages/${messageId}`),
  };

  /** Signalisation d'appel seulement : le média (LiveKit) n'est pas branché (voir README, « Appels : prototype D0 requis »). */
  const calls = {
    start: (conversationId: string, kind: CallKind) =>
      request<CallStartResponse>('POST', '/calls', { body: { conversation_id: conversationId, kind } }),
    accept: (id: string) => request<CallAcceptResponse>('POST', `/calls/${id}/accept`),
    decline: (id: string) => request<void>('POST', `/calls/${id}/decline`),
    end: (id: string) => request<void>('POST', `/calls/${id}/end`),
    renewToken: (id: string) => request<CallTokenResponse>('POST', `/calls/${id}/token`),
  };

  const billing = {
    offers: () => request<BillingOffers>('GET', '/billing/offers'),
    status: () => request<BillingStatus>('GET', '/billing/status'),
    sync: () => request<BillingStatus>('POST', '/billing/sync'),
    transactions: () => request<ListResponse<Transaction>>('GET', '/billing/transactions'),
  };

  const notifications = {
    registerDevice: (body: DeviceRegistration) => request<void>('PUT', '/me/device', { body }),
    preferences: () => request<NotificationPrefs>('GET', '/me/notifications'),
    updatePreferences: (body: Partial<NotificationPrefs>) =>
      request<NotificationPrefs>('PUT', '/me/notifications', { body }),
  };

  return { auth, profile, discovery, safety, messaging, calls, billing, notifications };
}

export type Api = ReturnType<typeof createEndpoints>;
