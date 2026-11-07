<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\DiscoveryQuery;
use App\Services\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DiscoveryController extends Controller
{
    public function __invoke(Request $request, DiscoveryQuery $discovery, ProfilePresenter $presenter): JsonResponse
    {
        $user = $request->user();
        abort_unless(Profile::where('user_id', $user->id)->exists(), 403, 'Profil à compléter.');

        $data = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:'.config('discovery.max_page_size')],
            'cursor' => ['nullable', 'string', 'max:200'],
            'age_min' => ['nullable', 'integer', 'min:18', 'max:99'],
            'age_max' => ['nullable', 'integer', 'min:18', 'max:99'],
            'countries' => ['nullable', 'array', 'max:20'],
            'countries.*' => ['regex:/^[A-Z]{2}$/'],
            'origins' => ['nullable', 'array', 'max:20'],
            'origins.*' => ['regex:/^[A-Z]{2}$/'],
            'intents' => ['nullable', 'array', 'max:5'],
            'intents.*' => [Rule::in(['marriage', 'long_lasting_love', 'flirt', 'friendship', 'lets_find_out'])],
            'verified_only' => ['nullable', 'boolean'],
            // Fraîcheur : n'afficher que les comptes vus depuis N jours (défaut : config discovery.active_within_days, nul = désactivé).
            'active_within_days' => ['nullable', 'integer', 'min:1', 'max:365'],
        ]);

        $prefs = $this->preferences($user->id);
        $filters = [
            'age_min' => $data['age_min'] ?? $prefs['age_min'],
            'age_max' => $data['age_max'] ?? $prefs['age_max'],
            'countries' => $data['countries'] ?? $prefs['countries'],
            'origins' => $data['origins'] ?? $prefs['origins'],
            'intents' => $data['intents'] ?? $prefs['intents'],
            'genders' => $prefs['seeking_genders'],
            'verified_only' => $data['verified_only'] ?? $prefs['verified_only'],
            'active_within_days' => $data['active_within_days'] ?? config('discovery.active_within_days'),
        ];

        $limit = (int) ($data['limit'] ?? config('discovery.page_size'));

        $query = $discovery->build($user->id, $filters)
            ->orderByDesc('profiles.created_at')->orderByDesc('profiles.id')
            ->select('profiles.id', 'profiles.created_at');

        if (! empty($data['cursor'])) {
            [$createdAt, $id] = $this->decode($data['cursor']);
            $query->whereRaw('(profiles.created_at, profiles.id) < (?::timestamptz, ?::uuid)', [$createdAt, $id]);
        }

        $rows = $query->limit($limit + 1)->get();
        $page = $rows->take($limit);
        // Profils + utilisateurs + médias : trois requêtes quelle que soit la taille de la page (revue CTO, risque 9).
        $profiles = Profile::with('user')->whereIn('id', $page->pluck('id'))->get()->keyBy('id');
        $presented = $presenter->publicMany($profiles);

        $last = $page->last();

        /**
         * @body array{data: list<array{user_id: string, display_name: string, age: int, gender: 'man'|'woman'|'other', origin_country: string, residence_country: string, city: string|null, bio: string|null, intent: 'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out', verified: bool, media: list<array{id: string, kind: 'profile_photo'|'profile_video', position: int, status: 'pending_upload'|'processing'|'approved'|null, url: string|null}>, last_seen_at?: string|null}>, next_cursor: string|null}
         */
        return response()->json([
            'data' => $page->map(fn ($r) => $presented[$profiles[$r->id]->user_id])->values(),
            'next_cursor' => $rows->count() > $limit && $last ? base64_encode($last->created_at.'|'.$last->id) : null,
        ]);
    }

    /** @return array{0: string, 1: string} */
    private function decode(string $cursor): array
    {
        $parts = explode('|', (string) base64_decode($cursor, true), 2);
        if (count($parts) !== 2 || ! preg_match('/^[0-9a-f-]{36}$/', $parts[1]) || strtotime($parts[0]) === false) {
            throw ValidationException::withMessages(['cursor' => ['Curseur invalide.']]);
        }

        return $parts;
    }

    /** @return array<string, mixed> */
    private function preferences(string $userId): array
    {
        $row = DB::table('preferences')->where('user_id', $userId)->first();
        $arr = fn ($v) => $v === null || $v === '{}' ? [] : array_values(array_filter(explode(',', trim($v, '{}')), 'strlen'));

        return [
            'age_min' => $row->age_min ?? 18,
            'age_max' => $row->age_max ?? 99,
            'countries' => $row ? $arr($row->countries) : [],
            'origins' => $row ? $arr($row->origins) : [],
            'intents' => $row ? $arr($row->intents) : [],
            'seeking_genders' => $row ? $arr($row->seeking_genders) : [],
            'verified_only' => (bool) ($row->verified_only ?? false),
        ];
    }
}
