import fs from 'fs';
import path from 'path';
import type { OpRequest, OpResponse } from '../src/api/generated';
import type {
  CallAcceptResponse,
  CallTokenResponse,
  ConversationListResponse,
  DeleteAccountResponse,
  DeviceRegistration,
  LiveKitInfo,
} from '../src/api/types';

/**
 * T090 : les types de l'API dérivent du contrat généré (`openapi.d.ts`) partout où le contrat est exploitable.
 * Ce fichier garde deux choses :
 *  1. à la compilation (`npm run typecheck`) : les types migrés sont identiques à ceux du contrat ;
 *  2. à l'exécution : la liste des types encore écrits à la main, avec la raison. Un type qui devient dérivable, ou un nouveau
 *     type écrit à la main, fait échouer le test : on décide alors, au lieu de laisser le manuscrit s'étendre sans le voir.
 */

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type MigratedTypesMatchTheContract = [
  Expect<Equal<DeleteAccountResponse, OpResponse<'account.destroy', 202>>>,
  Expect<Equal<CallAcceptResponse, OpResponse<'call.accept'>>>,
  Expect<Equal<CallTokenResponse, OpResponse<'call.token'>>>,
  Expect<Equal<LiveKitInfo, OpResponse<'call.token'>['livekit']>>,
  Expect<Equal<DeviceRegistration, OpRequest<'device.update'>>>,
  // La liste des conversations garde `meta` facultatif (un serveur plus ancien ne le renvoie pas) ; sa forme vient du contrat.
  Expect<Equal<NonNullable<ConversationListResponse['meta']>, OpResponse<'conversation.index'>['meta']>>,
  Expect<Equal<ConversationListResponse['data'][number]['unread'], number>>,
];

/**
 * « Rompre le match » : l'application lit `match_id` dans GET /conversations (nul hors match) et appelle DELETE /matches/{id}.
 * Elle n'utilise pas GET /matches (100 derniers matchs, sans curseur). Si le contrat perd `match_id` ou change son type, cette
 * ligne échoue à la compilation.
 */
export type ConversationsCarryTheMatchId = [Expect<Equal<ConversationListResponse['data'][number]['match_id'], string | null>>];

/** Types écrits à la main, et pourquoi le contrat ne peut pas (encore) les porter. */
const HAND_WRITTEN: Record<string, string> = {
  ApiErrorBody: 'format d’erreur commun, hors du contrat de chaque opération',
  Page: 'enveloppe générique de pagination (paramètre de type)',
  PageQuery: 'paramètres de pagination du client',
  ListResponse: 'enveloppe générique { data }',
  ConsentsPayload: 'le contrat n’accepte que des consentements « vrais » ; l’application garde les booléens des cases à cocher',
  OAuthProvider: 'le contrat type le fournisseur (paramètre de chemin) en string',
  DataExport: 'le contrat est une union dont `status` vaut string : le type manuscrit nomme les quatre états',
  VerificationStatus: 'le contrat de GET /me/verification type `verification_status` en unknown',
  VerificationRequestStatus: 'idem : le contrat ne décrit pas les états d’une demande',
  VerificationOverview: 'le contrat de GET /me/verification : `verification_status` unknown, `last_request` objet vide',
  DiscoverFilters: 'le contrat nomme les tableaux `countries[]` et accepte null ; le client envoie `countries` (sérialisé en countries[]=FR)',
  Block: 'le contrat décrit chaque élément de GET /blocks comme un objet vide',
  ReportResponse: 'le contrat ne documente que le statut « received » ; le serveur renvoie aussi « already_reported »',
  Sanction: 'le contrat décrit chaque élément de GET /me/sanctions comme un objet vide',
  SupportTicket: 'le contrat décrit chaque élément de GET /support/tickets comme un objet vide',
  SupportTicketCreated: 'le contrat ne documente que le statut « open »',
  CallKind: 'le contrat ne type pas le genre d’appel',
  CallStartResponse: 'le contrat ne documente que la réponse « ringing » (ring_seconds figé à 30) ; le serveur renvoie aussi « busy »',
  BillingOffers: 'le contrat type `months` et `credits` en string alors que le serveur renvoie des nombres',
  BillingStatus: 'le contrat décrit `subscription` comme un objet vide',
  Transaction: 'le contrat décrit chaque élément de GET /billing/transactions comme un objet vide',
  NotificationPrefs: 'le contrat décrit la réponse de GET /me/notifications comme un objet vide',
  ConversationStatus: 'le contrat de GET /conversations type `status` en string ; le client nomme les valeurs connues',
};

/** Noms des types dont la déclaration est un littéral (objet ou union de chaînes), donc écrite à la main. */
function handWrittenTypes(): string[] {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'api', 'types.ts'), 'utf8').replace(/\r\n/g, '\n');
  const names: string[] = [];
  const declaration = /^export type (\w+)(?:<[^>]*>)? =\s*([\s\S]*?)(?=\n(?:export |\/\*\*|\/\/|type )|$)/gm;
  for (const match of source.matchAll(declaration)) {
    const body = (match[2] ?? '').trimStart();
    if (body.startsWith('{') || body.startsWith("'")) names.push(match[1]!);
  }
  return names.sort();
}

describe('types de l’API (T090)', () => {
  it('la liste des types écrits à la main est connue et motivée', () => {
    expect(handWrittenTypes()).toEqual(Object.keys(HAND_WRITTEN).sort());
  });

  it('chaque type manuscrit a une raison écrite', () => {
    for (const [name, reason] of Object.entries(HAND_WRITTEN)) {
      expect({ name, reason: reason.length > 15 }).toEqual({ name, reason: true });
    }
  });
});
