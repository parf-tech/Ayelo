<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Candidats de découverte pour un utilisateur : filtres issus de ses préférences, surchargés par la requête.
 * Un candidat est actif, visible, majeur, a au moins une photo approuvée, n'est pas bloqué (dans les deux sens)
 * et n'a pas déjà fait l'objet d'un swipe.
 */
class DiscoveryQuery
{
    /**
     * @param  array<string, mixed>  $filters  age_min, age_max, countries[], origins[], intents[], genders[], verified_only, active_within_days
     */
    public function build(string $viewerId, array $filters): Builder
    {
        $q = DB::table('profiles')
            ->join('users', 'users.id', '=', 'profiles.user_id')
            ->where('profiles.user_id', '<>', $viewerId)
            ->where('profiles.is_visible', true)
            ->where('users.status', 'active')
            ->whereExists(fn ($s) => $s->select(DB::raw(1))->from('media')
                ->whereColumn('media.user_id', 'profiles.user_id')->where('media.kind', 'profile_photo')->where('media.status', 'approved'))
            ->whereNotExists(fn ($s) => $s->select(DB::raw(1))->from('swipes')
                ->where('swipes.swiper_id', $viewerId)->whereColumn('swipes.target_id', 'profiles.user_id'))
            ->whereNotExists(fn ($s) => $s->select(DB::raw(1))->from('blocks')
                ->where(fn ($w) => $w->where('blocks.blocker_id', $viewerId)->whereColumn('blocks.blocked_id', 'profiles.user_id')
                    ->orWhere(fn ($x) => $x->whereColumn('blocks.blocker_id', 'profiles.user_id')->where('blocks.blocked_id', $viewerId))));

        $today = CarbonImmutable::today();
        if (! empty($filters['age_min'])) {
            $q->where('users.birthdate', '<=', $today->subYears((int) $filters['age_min'])->toDateString());
        }
        if (! empty($filters['age_max'])) {
            $q->where('users.birthdate', '>', $today->subYears((int) $filters['age_max'] + 1)->toDateString());
        }
        if (! empty($filters['countries'])) {
            $q->whereRaw('profiles.residence_country = any(?::char(2)[])', [$this->pg($filters['countries'])]);
        }
        if (! empty($filters['origins'])) {
            $q->whereRaw('profiles.origin_country = any(?::char(2)[])', [$this->pg($filters['origins'])]);
        }
        if (! empty($filters['intents'])) {
            $q->whereRaw('profiles.intent = any(?::text[])', [$this->pg($filters['intents'])]);
        }
        if (! empty($filters['genders'])) {
            $q->whereRaw('profiles.gender = any(?::text[])', [$this->pg($filters['genders'])]);
        }
        if (! empty($filters['verified_only'])) {
            $q->where('profiles.verification_status', 'verified');
        }
        // Fraîcheur (revue CTO 2.1) : `last_seen_at` n'est renseigné qu'à la connexion ; un compte jamais vu (null) reste
        // éligible tant qu'il est récent, pour ne pas masquer les nouveaux inscrits. Index users_active_last_seen_idx.
        if (! empty($filters['active_within_days'])) {
            $since = CarbonImmutable::now()->subDays((int) $filters['active_within_days']);
            $q->where(fn ($w) => $w->where('users.last_seen_at', '>=', $since)
                ->orWhere(fn ($x) => $x->whereNull('users.last_seen_at')->where('users.created_at', '>=', $since)));
        }

        return $q;
    }

    /** @param list<string> $values */
    private function pg(array $values): string
    {
        return '{'.implode(',', array_map(fn ($v) => '"'.str_replace('"', '', $v).'"', $values)).'}';
    }
}
