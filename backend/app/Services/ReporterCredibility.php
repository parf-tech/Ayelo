<?php

namespace App\Services;

use App\Services\Admin\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Crédibilité des signaleurs pour la suspension préventive « mineur suspecté » (revue F-09, décision Q2-B).
 * Un signaleur crédible a un compte d'au moins `safety.reporter_min_age_days` jours, un e-mail vérifié, et au moins une
 * interaction réciproque avec la personne visée (match, ou conversation où elle a écrit ; voir hasInteraction). Deux comptes
 * jetables ne suffisent donc plus, ni une conversation ouverte d'office par un seul des deux.
 */
class ReporterCredibility
{
    /** Compte assez ancien ET e-mail vérifié (sans exiger d'interaction). */
    public function isEstablished(string $userId): bool
    {
        $minAge = max(0, (int) config('safety.reporter_min_age_days', 7));

        return DB::table('users')->where('id', $userId)->whereNotNull('email_verified_at')
            ->where('created_at', '<=', now()->subDays($minAge))->exists();
    }

    /**
     * Interaction RÉCIPROQUE entre les deux comptes (revue pentest P-02) : un match (les deux se sont choisis), ou une conversation
     * dans laquelle la personne visée a elle-même écrit au moins un message. Une conversation ouverte d'office par un crédit ou
     * le Premium, sans réponse de l'autre, ne prouve rien : sinon un compte dormant pouvait « fabriquer » l'interaction exigée
     * puis faire suspendre la cible. `$userId` est le signaleur, `$otherId` la personne visée.
     */
    public function hasInteraction(string $userId, string $otherId): bool
    {
        $pair = [$userId, $otherId];
        sort($pair, SORT_STRING);

        if (DB::table('matches')->where('user_a', $pair[0])->where('user_b', $pair[1])->exists()) {
            return true;
        }

        return DB::table('conversations')->join('messages', 'messages.conversation_id', '=', 'conversations.id')
            ->where('conversations.user_a', $pair[0])->where('conversations.user_b', $pair[1])
            ->where('messages.sender_id', $otherId)->whereNotIn('messages.type', ['system', 'call_missed'])
            ->exists();
    }

    public function isCredible(string $userId, string $targetId): bool
    {
        return $this->isEstablished($userId) && $this->hasInteraction($userId, $targetId);
    }

    /** Nombre de signaleurs crédibles distincts (autres que $exceptId) ayant signalé « mineur suspecté » cette personne en 7 jours. */
    public function otherCredibleMinorReporters(string $targetId, string $exceptId): int
    {
        $ids = DB::table('reports')->where('reported_id', $targetId)->where('reason', 'minor_suspected')
            ->where('reporter_id', '<>', $exceptId)->where('created_at', '>=', now()->subDays(7))
            ->distinct()->pluck('reporter_id');

        return $ids->filter(fn ($id) => $id !== null && $this->isCredible((string) $id, $targetId))->count();
    }

    /**
     * Ratio anormal : au moins N signalements tranchés (classés ou rejetés) sur la fenêtre, aucun classé (confirmé).
     * Les signalements encore ouverts ne comptent pas, pour ne pas accuser un signaleur dont la file n'est pas traitée.
     */
    public function hasAbnormalRatio(string $reporterId): bool
    {
        $since = now()->subDays(max(1, (int) config('safety.reporter_alert_window_days', 30)));
        $base = fn () => DB::table('reports')->where('reporter_id', $reporterId)->where('created_at', '>=', $since);

        $confirmed = $base()->where('status', 'actioned')->count();
        $decided = $base()->whereIn('status', ['actioned', 'dismissed'])->count();

        return $confirmed === 0 && $decided >= max(1, (int) config('safety.reporter_alert_min_reports', 5));
    }

    /** Journal d'alerte + ligne d'audit (au plus une par signaleur et par 24 h). Retourne vrai si une alerte a été écrite. */
    public function alertIfAbnormal(string $reporterId): bool
    {
        if (! $this->hasAbnormalRatio($reporterId)) {
            return false;
        }

        $already = DB::table('audit_logs')->where('action', 'reporter.abnormal_ratio')->where('subject_type', 'users')
            ->where('subject_id', $reporterId)->where('created_at', '>=', now()->subDay())->exists();
        if ($already) {
            return false;
        }

        $window = (int) config('safety.reporter_alert_window_days', 30);
        Log::warning('Signaleur au ratio anormal : signalements tranchés sans aucun confirmé.', ['reporter_id' => $reporterId, 'window_days' => $window]);
        app(Audit::class)->record(null, 'reporter.abnormal_ratio', 'users', $reporterId, null, [
            'window_days' => $window,
            'decided' => DB::table('reports')->where('reporter_id', $reporterId)->where('created_at', '>=', now()->subDays($window))
                ->whereIn('status', ['actioned', 'dismissed'])->count(),
            'confirmed' => 0,
        ]);

        return true;
    }
}
