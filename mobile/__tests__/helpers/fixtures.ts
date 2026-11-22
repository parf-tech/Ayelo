import type { Conversation, Me, Message, ProfileMedia, PublicProfile, SelfProfile } from '../../src/api/types';

export function media(id: string, position: number, status: ProfileMedia['status'] = 'approved', url: string | null = `https://cdn.example.test/${id}.jpg`): ProfileMedia {
  return { id, kind: 'profile_photo', position, status, url };
}

export function publicProfile(id: string, name = 'Awa', extra: Partial<PublicProfile> = {}): PublicProfile {
  return {
    user_id: id,
    display_name: name,
    age: 28,
    gender: 'woman',
    origin_country: 'CI',
    residence_country: 'FR',
    city: 'Paris',
    bio: 'Bonjour',
    intent: 'long_lasting_love',
    verified: false,
    media: [media(`${id}-m1`, 0)],
    ...extra,
  };
}

export function selfProfile(extra: Partial<SelfProfile> = {}): SelfProfile {
  return {
    ...publicProfile('u1', 'Moi'),
    is_visible: true,
    hide_distance: false,
    hide_last_seen: false,
    verification_status: 'none',
    ...extra,
  };
}

export function meFixture(extra: Partial<Me> = {}): Me {
  return {
    id: 'u1',
    email: 'moi@example.test',
    email_verified: true,
    locale: 'fr',
    age: 28,
    profile: selfProfile(),
    credits: { conversation: 0, proposal: 0, coin: 0 },
    premium: false,
    ...extra,
  };
}

export function message(id: string, sender: string, body: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    conversation_id: 'c1',
    sender_id: sender,
    client_id: `cid-${id}`,
    type: 'text',
    body,
    media_id: null,
    delivered_at: null,
    read_at: null,
    created_at: `2026-11-06T10:00:0${id.length % 10}.000000Z`,
    ...extra,
  };
}

export function conversation(id: string, peer: PublicProfile, extra: Partial<Conversation> = {}): Conversation {
  // `match_id` : renseigné pour une conversation issue d'un match (par défaut), nul sinon.
  const matchId = (extra.unlocked_by ?? 'match') === 'match' ? `m-${id}` : null;
  return { id, match_id: matchId, status: 'active', unlocked_by: 'match', unread: 0, last_message: null, profile: peer, ...extra };
}
