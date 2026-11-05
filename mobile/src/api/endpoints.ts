import type { ApiClient } from './client';
import type {
  AgeCheckResponse,
  AuthResponse,
  Block,
  BillingOffers,
  BillingStatus,
  CallKind,
  CallWithToken,
  ConsentUpdate,
  Conversation,
  DataExport,
  DeviceRegistration,
  DiscoverFilters,
  Gift,
  GiftSendRequest,
  GiftSendResponse,
  Invite,
  InviteRequest,
  LiveKitToken,
  LoginRequest,
  Match,
  Me,
  Media,
  Message,
  NotificationPrefs,
  OAuthProvider,
  OAuthRequest,
  Page,
  PageQuery,
  Preferences,
  PrivacyInput,
  Profile,
  ProfileInput,
  PublicProfile,
  RegisterRequest,
  ReportRequest,
  Sanction,
  SendMessageRequest,
  Session,
  Story,
  StoryGroup,
  StoryRequest,
  StoryViewer,
  SupportTicket,
  SwipeAction,
  SwipeResult,
  Transaction,
  UploadUrlRequest,
  UploadUrlResponse,
  VerificationRequest,
} from './types';

/**
 * Toutes les routes de docs/10-API-SPECIFICATIONS.md.
 * Seules ageCheck, register, login, logout et me existent côté backend aujourd'hui ;
 * les écrans n'appellent que celles-là.
 */
export function createEndpoints(client: ApiClient) {
  const { request } = client;

  const auth = {
    /** Contrôle d'âge AVANT création du compte. 403 { code: 'age_not_eligible' } = refus. */
    ageCheck: (birthdate: string) =>
      request<AgeCheckResponse>('POST', '/auth/age-check', { auth: false, body: { birthdate } }),
    register: (body: RegisterRequest) =>
      request<AuthResponse>('POST', '/auth/register', { auth: false, body }),
    login: (body: LoginRequest) => request<AuthResponse>('POST', '/auth/login', { auth: false, body }),
    logout: () => request<void>('POST', '/auth/logout'),
    me: () => request<Me>('GET', '/me'),

    oauth: (provider: OAuthProvider, body: OAuthRequest) =>
      request<AuthResponse>('POST', `/auth/oauth/${provider}`, { auth: false, body }),
    verifyEmail: (token: string) => request<void>('POST', '/auth/email/verify', { auth: false, body: { token } }),
    resendEmail: () => request<void>('POST', '/auth/email/resend'),
    sendPhoneCode: (phone: string) => request<void>('POST', '/auth/phone/send', { body: { phone } }),
    verifyPhone: (code: string) => request<void>('POST', '/auth/phone/verify', { body: { code } }),
    forgotPassword: (email: string) =>
      request<void>('POST', '/auth/password/forgot', { auth: false, body: { email } }),
    resetPassword: (token: string, password: string) =>
      request<void>('POST', '/auth/password/reset', { auth: false, body: { token, password } }),
    sessions: () => request<Session[]>('GET', '/auth/sessions'),
    closeSession: (id: string) => request<void>('DELETE', `/auth/sessions/${id}`),
    closeAllSessions: () => request<void>('DELETE', '/auth/sessions'),
    updateConsent: (body: ConsentUpdate) => request<void>('POST', '/me/consents', { body }),
    requestAccountDeletionByEmail: (email: string) =>
      request<void>('POST', '/account-deletion-requests', { auth: false, body: { email } }),
    /** Ré-authentification : mot de passe, ou jeton frais du fournisseur pour un compte social. */
    deleteAccount: (reauth: { password?: string; provider?: OAuthProvider; provider_token?: string }) =>
      request<void>('DELETE', '/me', { body: reauth }),
    requestExport: () => request<DataExport>('POST', '/me/export'),
    getExport: (id: string) => request<DataExport>('GET', `/me/export/${id}`),
  };

  const profile = {
    update: (body: ProfileInput) => request<Profile>('PUT', '/me/profile', { body }),
    updatePreferences: (body: Partial<Preferences>) => request<Preferences>('PUT', '/me/preferences', { body }),
    updatePrivacy: (body: PrivacyInput) => request<Profile>('PATCH', '/me/privacy', { body }),
    createUploadUrl: (body: UploadUrlRequest) => request<UploadUrlResponse>('POST', '/media/upload-url', { body }),
    completeUpload: (mediaId: string) => request<Media>('POST', `/media/${mediaId}/complete`),
    orderMedia: (ids: string[]) => request<void>('PUT', '/me/media/order', { body: { ids } }),
    deleteMedia: (mediaId: string) => request<void>('DELETE', `/media/${mediaId}`),
    startVerification: (selfieMediaId: string) =>
      request<VerificationRequest>('POST', '/me/verification', { body: { selfie_media_id: selfieMediaId } }),
    verification: () => request<VerificationRequest>('GET', '/me/verification'),
    publicProfile: (id: string) => request<PublicProfile>('GET', `/profiles/${id}`),
  };

  const discovery = {
    discover: (filters: DiscoverFilters = {}) =>
      request<Page<PublicProfile>>('GET', '/discover', { query: { ...filters } }),
    swipe: (targetId: string, action: SwipeAction) =>
      request<SwipeResult>('POST', '/swipes', { body: { target_id: targetId, action } }),
    undoSwipe: () => request<PublicProfile>('POST', '/swipes/undo'),
    matches: (page: PageQuery = {}) => request<Page<Match>>('GET', '/matches', { query: { ...page } }),
    deleteMatch: (id: string) => request<void>('DELETE', `/matches/${id}`),
  };

  const safety = {
    block: (blockedId: string) => request<void>('POST', '/blocks', { body: { blocked_id: blockedId } }),
    unblock: (id: string) => request<void>('DELETE', `/blocks/${id}`),
    blocks: () => request<Block[]>('GET', '/blocks'),
    report: (body: ReportRequest) => request<void>('POST', '/reports', { body }),
    sanctions: () => request<Sanction[]>('GET', '/me/sanctions'),
    appeal: (sanctionId: string, message: string) =>
      request<void>('POST', '/appeals', { body: { sanction_id: sanctionId, message } }),
    createSupportTicket: (subject: string, body: string) =>
      request<SupportTicket>('POST', '/support/tickets', { body: { subject, body } }),
    supportTickets: () => request<SupportTicket[]>('GET', '/support/tickets'),
  };

  const messaging = {
    conversations: (page: PageQuery = {}) =>
      request<Page<Conversation>>('GET', '/conversations', { query: { ...page } }),
    openConversation: (targetId: string) =>
      request<Conversation>('POST', '/conversations', { body: { target_id: targetId } }),
    messages: (conversationId: string, page: PageQuery = {}) =>
      request<Page<Message>>('GET', `/conversations/${conversationId}/messages`, { query: { ...page } }),
    sendMessage: (conversationId: string, body: SendMessageRequest) =>
      request<Message>('POST', `/conversations/${conversationId}/messages`, {
        body,
        idempotencyKey: body.client_id,
      }),
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

  /** Phase D : client prêt, aucun écran d'appel pour l'instant. */
  const calls = {
    start: (conversationId: string, kind: CallKind) =>
      request<CallWithToken>('POST', '/calls', { body: { conversation_id: conversationId, kind } }),
    accept: (id: string) => request<LiveKitToken>('POST', `/calls/${id}/accept`),
    decline: (id: string) => request<void>('POST', `/calls/${id}/decline`),
    end: (id: string) => request<void>('POST', `/calls/${id}/end`),
    renewToken: (id: string) => request<LiveKitToken>('POST', `/calls/${id}/token`),
  };

  const content = {
    stories: () => request<StoryGroup[]>('GET', '/stories'),
    publishStory: (body: StoryRequest) => request<Story>('POST', '/stories', { body }),
    markStoryViewed: (id: string) => request<void>('POST', `/stories/${id}/view`),
    reactToStory: (id: string, emoji: string) => request<void>('POST', `/stories/${id}/react`, { body: { emoji } }),
    storyViewers: (id: string) => request<StoryViewer[]>('GET', `/stories/${id}/viewers`),
    deleteStory: (id: string) => request<void>('DELETE', `/stories/${id}`),
    invites: (query: { country?: string; cursor?: string } = {}) =>
      request<Page<Invite>>('GET', '/invites', { query }),
    publishInvite: (body: InviteRequest) => request<Invite>('POST', '/invites', { body }),
    deleteInvite: (id: string) => request<void>('DELETE', `/invites/${id}`),
  };

  const billing = {
    offers: () => request<BillingOffers>('GET', '/billing/offers'),
    status: () => request<BillingStatus>('GET', '/billing/status'),
    sync: () => request<BillingStatus>('POST', '/billing/sync'),
    transactions: (page: PageQuery = {}) =>
      request<Page<Transaction>>('GET', '/billing/transactions', { query: { ...page } }),
    gifts: () => request<Gift[]>('GET', '/gifts'),
    sendGift: (body: GiftSendRequest, idempotencyKey: string) =>
      request<GiftSendResponse>('POST', '/gifts/send', { body, idempotencyKey }),
  };

  const notifications = {
    registerDevice: (body: DeviceRegistration) => request<void>('PUT', '/me/device', { body }),
    preferences: () => request<NotificationPrefs>('GET', '/me/notifications'),
    updatePreferences: (body: NotificationPrefs) => request<NotificationPrefs>('PUT', '/me/notifications', { body }),
  };

  return { auth, profile, discovery, safety, messaging, calls, content, billing, notifications };
}

export type Api = ReturnType<typeof createEndpoints>;
