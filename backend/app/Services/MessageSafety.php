<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Détection simple de demandes d'argent dans les messages (FR-I-6) : ne bloque pas le message,
 * ajoute un signal de risque pour l'expéditeur et un conseil affiché au destinataire.
 * Liste volontairement courte, par langue (fr, en) ; à enrichir avec les signalements réels.
 */
class MessageSafety
{
    private const PATTERNS = [
        '/\b(western\s*union|moneygram|mobile\s*money|orange\s*money|mtn\s*money|wave|paypal|cash\s*app|bitcoin|crypto(monnaie)?|gift\s*card|carte\s*cadeau)\b/iu',
        '/\b(envoie(r|z)?|transf[eè]re(r|z)?|vire(r|z)?|send|wire)\b.{0,30}\b(argent|money|cash|fonds|euros?|dollars?|fcfa|xaf|xof)\b/iu',
        '/\b(j\'?ai\s+besoin\s+d\'?argent|i\s+need\s+(some\s+)?money|aide\s*-?moi\s+financi[eè]rement|frais\s+de\s+(visa|douane|transport))\b/iu',
    ];

    /** @return string|null "money_request" si le texte ressemble à une demande d'argent */
    public function inspect(string $senderId, string $text): ?string
    {
        foreach (self::PATTERNS as $pattern) {
            if (preg_match($pattern, $text) === 1) {
                // Au plus un signal par expéditeur et par jour, pour ne pas gonfler le score.
                $already = DB::table('risk_events')->where('user_id', $senderId)->where('signal', 'money_keywords')->where('created_at', '>=', now()->startOfDay())->exists();
                if (! $already) {
                    DB::table('risk_events')->insert(['id' => (string) Str::uuid(), 'user_id' => $senderId, 'signal' => 'money_keywords', 'weight' => 5, 'created_at' => now()]);
                    DB::table('users')->where('id', $senderId)->update(['risk_score' => DB::raw('least(100, risk_score + 5)')]);
                }

                return 'money_request';
            }
        }

        return null;
    }
}
