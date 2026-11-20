<?php

namespace App\Http\Controllers;

use App\Services\MailSuppression;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Webhook de rebonds et de plaintes du prestataire d'e-mail : Resend (signature Svix) ou Postmark (secret partagé).
 * Idempotent (un doublon est sans effet) ; répond 200 même pour un événement ignoré, sinon le prestataire réessaie en boucle.
 * Aucune adresse dans les journaux : seulement des compteurs.
 */
class MailWebhookController extends Controller
{
    /** Plafond d'adresses lues dans un seul événement (data.to[] de Resend). */
    private const MAX_RECIPIENTS = 50;

    /** Écart maximal (secondes) entre svix-timestamp et l'heure du serveur : au-delà, le message est un rejeu possible. */
    private const SVIX_TOLERANCE_SECONDS = 300;

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
        // Des en-têtes Svix imposent la vérification de signature : le secret partagé ne la remplace jamais.
        if ($request->headers->has('svix-signature') || $request->headers->has('svix-id')) {
            return $this->svixSignatureValid($request);
        }

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
     * Signature Svix (Resend) : HMAC-SHA256, clé = secret « whsec_... » décodé de base64, message = « svix-id.svix-timestamp.corps brut ».
     * L'en-tête svix-signature peut porter plusieurs signatures « v1,... » séparées par des espaces (rotation du secret) : une seule
     * doit correspondre. Comparaison en temps constant ; horodatage borné contre le rejeu.
     */
    private function svixSignatureValid(Request $request): bool
    {
        $secret = (string) config('services.mail_webhook.svix_secret');
        if ($secret === '') {
            return false; // pas de secret configuré : la route reste fermée
        }

        $key = base64_decode(str_starts_with($secret, 'whsec_') ? substr($secret, 6) : $secret, true);
        if ($key === false || $key === '') {
            return false; // secret mal formé : fermé plutôt qu'ouvert
        }

        $id = (string) $request->header('svix-id', '');
        $timestamp = (string) $request->header('svix-timestamp', '');
        if ($id === '' || $timestamp === '' || ! ctype_digit($timestamp) || abs(now()->getTimestamp() - (int) $timestamp) > self::SVIX_TOLERANCE_SECONDS) {
            return false;
        }

        $expected = base64_encode(hash_hmac('sha256', $id.'.'.$timestamp.'.'.$request->getContent(), $key, true));
        foreach (explode(' ', (string) $request->header('svix-signature', '')) as $candidate) {
            [$version, $signature] = array_pad(explode(',', $candidate, 2), 2, '');
            if ($version === 'v1' && hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
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
