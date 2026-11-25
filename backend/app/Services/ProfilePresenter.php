<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\User;
use App\Services\Storage\MediaStorage;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Représentation JSON des profils : complète pour soi, restreinte pour les autres. */
class ProfilePresenter
{
    public function __construct(private MediaStorage $storage, private Presence $presence) {}

    /**
     * Profil du propriétaire : les champs de confidentialité et de vérification s'ajoutent à ceux des autres.
     * `media[].status` n'est renseigné que pour le propriétaire.
     *
     * @return array<string, mixed>
     *
     * @scramble-return array{id: string, email: string|null, email_verified: bool, locale: 'fr'|'en', age: int, profile: array{user_id: string, display_name: string, age: int, gender: 'man'|'woman'|'other', origin_country: string, residence_country: string, city: string|null, bio: string|null, intent: 'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out', verified: bool, media: list<array{id: string, kind: 'profile_photo'|'profile_video', position: int, status: 'pending_upload'|'processing'|'approved'|null, url: string|null}>, is_visible: bool, hide_distance: bool, hide_last_seen: bool, verification_status: 'none'|'pending'|'verified'|'rejected'}|null, credits: array{conversation: int, proposal: int, coin: int}, premium: bool}
     */
    public function self(User $user, ?Profile $profile): array
    {
        // Soldes lus dans `credit_balances` (tenue à jour par un déclencheur sur le registre) : au plus trois lignes, sans parcourir
        // l'historique des crédits (revue CTO 1).
        $sums = DB::table('credit_balances')->where('user_id', $user->id)->pluck('balance', 'credit_type');
        $balance = fn (string $type) => (int) ($sums[$type] ?? 0);

        return [
            'id' => $user->id,
            'email' => $user->email,
            'email_verified' => $user->email_verified_at !== null,
            'locale' => $user->locale,
            'age' => $user->birthdate->age,
            'profile' => $profile ? $this->base($profile, $user, true) : null,
            'credits' => ['conversation' => $balance('conversation'), 'proposal' => $balance('proposal'), 'coin' => $balance('coin')],
            'premium' => DB::table('subscriptions')->where('user_id', $user->id)->where('status', 'active')->where('period_end', '>', now())->exists(),
        ];
    }

    /**
     * `last_seen_at` et `online` sont absents quand la personne les masque ; `media[].status` est toujours nul pour les autres.
     *
     * @return array<string, mixed>
     *
     * @scramble-return array{user_id: string, display_name: string, age: int, gender: 'man'|'woman'|'other', origin_country: string, residence_country: string, city: string|null, bio: string|null, intent: 'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out', verified: bool, media: list<array{id: string, kind: 'profile_photo'|'profile_video', position: int, status: 'pending_upload'|'processing'|'approved'|null, url: string|null}>, last_seen_at?: string|null, online?: bool}
     */
    public function public(Profile $profile): array
    {
        $profile->loadMissing('user');

        return $this->base($profile, $profile->user, false);
    }

    /**
     * Version en lot de `public()` pour les listes (découverte, conversations, matchs) : deux requêtes au total
     * (utilisateurs, médias) quel que soit le nombre de profils, au lieu d'une requête médias par profil (revue CTO, risque 9).
     *
     * @param  iterable<Profile>  $profiles
     * @return array<string, array<string, mixed>> profils présentés, indexés par `user_id`
     */
    public function publicMany(iterable $profiles): array
    {
        $profiles = new EloquentCollection(is_array($profiles) ? $profiles : iterator_to_array($profiles, false));
        $profiles->loadMissing('user');
        $media = $this->mediaFor($profiles->pluck('user_id')->all(), false);
        // Présence de toute la liste en une seule lecture groupée du cache.
        $online = $this->presence->onlineAmong($profiles->pluck('user_id')->all());

        $out = [];
        foreach ($profiles as $profile) {
            $out[$profile->user_id] = $this->base($profile, $profile->user, false, $media->get($profile->user_id, collect()), $online);
        }

        return $out;
    }

    /**
     * Médias de profil de plusieurs personnes en une seule requête, groupés par `user_id`.
     *
     * @param  list<string>  $userIds
     * @return Collection<string, Collection<int, object>>
     */
    private function mediaFor(array $userIds, bool $owner): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        return DB::table('media')
            ->whereIn('user_id', $userIds)
            ->whereIn('kind', ['profile_photo', 'profile_video'])
            ->when(! $owner, fn ($q) => $q->where('status', 'approved'))
            ->when($owner, fn ($q) => $q->whereIn('status', ['pending_upload', 'processing', 'approved']))
            ->orderBy('kind')->orderBy('position')
            ->get(['id', 'user_id', 'kind', 'status', 'position', 'storage_key'])
            ->groupBy('user_id');
    }

    /** @return array<string, mixed> */
    private function base(Profile $profile, User $user, bool $owner, ?Collection $preloadedMedia = null, ?array $online = null): array
    {
        // Les listes passent leurs médias préchargés (`publicMany`) ; un profil isolé fait sa propre requête.
        $media = $preloadedMedia ?? $this->mediaFor([$user->id], $owner)->get($user->id, collect());

        $data = [
            'user_id' => $user->id,
            'display_name' => $profile->display_name,
            'age' => $user->birthdate->age,
            'gender' => $profile->gender,
            'origin_country' => $profile->origin_country,
            'residence_country' => $profile->residence_country,
            'city' => $profile->city,
            'bio' => $profile->bio,
            'intent' => $profile->intent,
            'verified' => $profile->verification_status === 'verified',
            'media' => $media->map(fn ($m) => [
                'id' => $m->id,
                'kind' => $m->kind,
                'position' => $m->position,
                'status' => $owner ? $m->status : null,
                'url' => ($owner || $m->status === 'approved') && $m->status !== 'pending_upload'
                    ? $this->storage->temporaryUrl($m->storage_key, (int) config('media.read_ttl_minutes')) : null,
            ])->values()->all(),
        ];

        // Dernière connexion et présence en ligne (FR-D-4) : masquées ensemble par `hide_last_seen` (FR-B-7), jamais montrées à soi-même.
        if (! $profile->hide_last_seen && ! $owner) {
            $data['last_seen_at'] = $user->last_seen_at?->toIso8601String();
            $data['online'] = $online !== null ? isset($online[$user->id]) : $this->presence->isOnline($user->id);
        }

        if ($owner) {
            $data += [
                'is_visible' => $profile->is_visible,
                'hide_distance' => $profile->hide_distance,
                'hide_last_seen' => $profile->hide_last_seen,
                'verification_status' => $profile->verification_status,
            ];
        }

        return $data;
    }
}
