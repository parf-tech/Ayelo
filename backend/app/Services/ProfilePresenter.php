<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\User;
use App\Services\Storage\MediaStorage;
use Illuminate\Support\Facades\DB;

/** Représentation JSON des profils : complète pour soi, restreinte pour les autres. */
class ProfilePresenter
{
    public function __construct(private MediaStorage $storage) {}

    /** @return array<string, mixed> */
    public function self(User $user, ?Profile $profile): array
    {
        $balance = fn (string $type) => (int) DB::table('credit_ledger')->where('user_id', $user->id)->where('credit_type', $type)->sum('delta');

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

    /** @return array<string, mixed> */
    public function public(Profile $profile): array
    {
        $profile->loadMissing('user');

        return $this->base($profile, $profile->user, false);
    }

    /** @return array<string, mixed> */
    private function base(Profile $profile, User $user, bool $owner): array
    {
        $media = DB::table('media')
            ->where('user_id', $user->id)
            ->whereIn('kind', ['profile_photo', 'profile_video'])
            ->when(! $owner, fn ($q) => $q->where('status', 'approved'))
            ->when($owner, fn ($q) => $q->whereIn('status', ['pending_upload', 'processing', 'approved']))
            ->orderBy('kind')->orderBy('position')
            ->get(['id', 'kind', 'status', 'position', 'storage_key']);

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

        if (! $profile->hide_last_seen && ! $owner) {
            $data['last_seen_at'] = $user->last_seen_at?->toIso8601String();
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
