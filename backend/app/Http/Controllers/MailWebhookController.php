<?php

namespace App\Http\Controllers;

use App\Services\MailSuppression;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Webhook de rebonds et de plaintes du prestataire d'e-mail (Postmark ou Resend), authentifié par secret partagé.
 * Idempotent (un doublon est sans effet) ; répond 200 même pour un événement ignoré, sinon le prestataire réessaie en boucle.
 * Aucune adresse dans les journaux : seulement des compteurs.
 */
class MailWebhookController extends Controller
{
    /** Plafond d'adresses lues dans un seul événement (data.to[] de Resend). */
    private const MAX_RECIPIENTS = 50;

    /**
     * Événement traité (ou ignoré) ; la réponse ne dit jamais quelles adresses sont supprimées.
     *
     * @status 200
     *
     * @body array{result: 'ok'|'ignored', suppressed: int}
     */
    public function __invoke(Request $request, MailSuppression $suppression): JsonResponse
    {
        if (! $this->authorized($request)) {
            return response()->json(['error' => ['code' => 'unauthorized', 'message' => 'Non autorisé.']], 401);
        }

        $event = $this->parse($request->json()->all());
        if ($event === null) {
            return response()->json(['result' => 'ignored', 'suppressed' => 0]);
        }

        [$provider, $reason, $emails] = $event;
        $created = 0;
        foreach ($emails as $email) {
            $created += $suppression->suppress($email, $reason, $provider) ? 1 : 0;
        }

        return response()->json(['result' => 'ok', 'suppressed' => $created]);
    }

    private function authorized(Request $request): bool
    {
        $secret = (string) config('services.mail_webhook.secret');
        if ($secret === '') {
            return false; // pas de secret configuré : la route reste fermée
        }

        $given = (string) $request->header('X-Mail-Webhook-Secret', '');
        if ($given === '') {
            $auth = (string) $request->header('Authorization', '');
            $given = str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : $auth;
        }

        return hash_equals($secret, $given);
    }

    /**
     * @param  array<mixed>  $payload
     * @return array{0: string, 1: string, 2: list<string>}|null [prestataire, motif, adresses] ou null si l'événement est sans effet
     */
    private function parse(array $payload): ?array
    {
        // Postmark : RecordType « Bounce » (Type « HardBounce » ou « SpamComplaint ») ou « SpamComplaint » ; adresse dans Email.
        $record = $payload['RecordType'] ?? null;
        if (is_string($record)) {
            $type = is_string($payload['Type'] ?? null) ? $payload['Type'] : '';
            $reason = match (true) {
                $record === 'SpamComplaint', $record === 'Bounce' && $type === 'SpamComplaint' => MailSuppression::COMPLAINT,
                $record === 'Bounce' && $type === 'HardBounce' => MailSuppression::HARD_BOUNCE,
                default => null,
            };

            return $reason !== null && is_string($payload['Email'] ?? null) ? ['postmark', $reason, [$payload['Email']]] : null;
        }

        // Resend : type « email.bounced » ou « email.complained » ; destinataires dans data.to[].
        $type = $payload['type'] ?? null;
        $data = $payload['data'] ?? null;
        if (! is_string($type) || ! is_array($data)) {
            return null;
        }
        if ($type === 'email.bounced') {
            // Un rebond temporaire (boîte pleine, panne passagère) ne supprime rien ; sans précision, on suppose définitif.
            $bounce = is_array($data['bounce'] ?? null) ? ($data['bounce']['type'] ?? null) : null;
            if (is_string($bounce) && strcasecmp($bounce, 'Permanent') !== 0) {
                return null;
            }
            $reason = MailSuppression::HARD_BOUNCE;
        } elseif ($type === 'email.complained') {
            $reason = MailSuppression::COMPLAINT;
        } else {
            return null;
        }

        $to = is_array($data['to'] ?? null) ? array_slice($data['to'], 0, self::MAX_RECIPIENTS) : [];
        $emails = array_values(array_filter($to, 'is_string'));

        return $emails === [] ? null : ['resend', $reason, $emails];
    }
}
