<?php

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Services\ProfilePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProfileController extends Controller
{
    private const GENDERS = ['man', 'woman', 'other'];

    private const INTENTS = ['marriage', 'long_lasting_love', 'flirt', 'friendship', 'lets_find_out'];

    public function me(Request $request, ProfilePresenter $presenter): JsonResponse
    {
        $user = $request->user();

        return response()->json($presenter->self($user, Profile::where('user_id', $user->id)->first()));
    }

    public function upsert(Request $request, ProfilePresenter $presenter): JsonResponse
    {
        $user = $request->user();
        $profile = Profile::where('user_id', $user->id)->first();

        // Seules les chaînes sont mises en majuscules : un tableau reste tel quel et échoue à la validation (422, pas 500 - revue F-24).
        $request->merge(collect(['origin_country', 'residence_country'])
            ->filter(fn ($k) => is_string($request->input($k)))
            ->mapWithKeys(fn ($k) => [$k => strtoupper($request->input($k))])->all());

        $required = $profile === null ? 'required' : 'sometimes';
        $data = $request->validate([
            'display_name' => [$required, 'string', 'min:2', 'max:40'],
            'gender' => [$required, Rule::in(self::GENDERS)],
            'origin_country' => [$required, 'regex:/^[A-Z]{2}\z/'],
            'residence_country' => [$required, 'regex:/^[A-Z]{2}\z/'],
            'city' => ['nullable', 'string', 'max:80'],
            'bio' => ['nullable', 'string', 'max:500'],
            'intent' => [$required, Rule::in(self::INTENTS)],
        ]);

        if ($profile === null) {
            $profile = new Profile(['user_id' => $user->id]);
        } elseif (isset($data['residence_country']) && $data['residence_country'] !== $profile->residence_country) {
            // Un changement de pays par semaine au maximum (anti-fraude, docs/03 cas limite 6).
            if ($profile->residence_changed_at && $profile->residence_changed_at->gt(now()->subWeek())) {
                throw ValidationException::withMessages(['residence_country' => ['Le pays de résidence ne peut être modifié qu\'une fois par semaine.']]);
            }
            $profile->residence_changed_at = now();
        }

        $profile->fill($data)->save();

        $payload = $presenter->self($user, $profile->fresh());

        if ($profile->wasRecentlyCreated) {
            return response()->json($payload, 201);
        }

        return response()->json($payload, 200);
    }

    public function privacy(Request $request, ProfilePresenter $presenter): JsonResponse
    {
        $data = $request->validate([
            'is_visible' => ['sometimes', 'boolean'],
            'hide_distance' => ['sometimes', 'boolean'],
            'hide_last_seen' => ['sometimes', 'boolean'],
        ]);

        $profile = Profile::where('user_id', $request->user()->id)->firstOrFail();
        $profile->fill($data)->save();

        return response()->json($presenter->self($request->user(), $profile->fresh()));
    }

    public function preferences(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($request->isMethod('GET')) {
            return response()->json($this->preferencesFor($user->id));
        }

        $data = $request->validate([
            'seeking_genders' => ['sometimes', 'array', 'max:3'],
            'seeking_genders.*' => [Rule::in(self::GENDERS)],
            'age_min' => ['sometimes', 'integer', 'min:18', 'max:99'],
            'age_max' => ['sometimes', 'integer', 'min:18', 'max:99'],
            'countries' => ['sometimes', 'array', 'max:20'],
            'countries.*' => ['regex:/^[A-Z]{2}\z/'],
            'origins' => ['sometimes', 'array', 'max:20'],
            'origins.*' => ['regex:/^[A-Z]{2}\z/'],
            'intents' => ['sometimes', 'array', 'max:5'],
            'intents.*' => [Rule::in(self::INTENTS)],
            'verified_only' => ['sometimes', 'boolean'],
            'max_distance_km' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
        ]);

        $current = $this->preferencesFor($user->id);
        $merged = array_merge($current, $data);
        if ($merged['age_max'] < $merged['age_min']) {
            throw ValidationException::withMessages(['age_max' => ['age_max doit être supérieur ou égal à age_min.']]);
        }

        $pg = fn (array $v) => '{'.implode(',', array_map(fn ($x) => '"'.$x.'"', $v)).'}';

        DB::table('preferences')->updateOrInsert(['user_id' => $user->id], [
            'seeking_genders' => $pg($merged['seeking_genders']),
            'age_min' => $merged['age_min'],
            'age_max' => $merged['age_max'],
            'countries' => $pg($merged['countries']),
            'origins' => $pg($merged['origins']),
            'intents' => $pg($merged['intents']),
            'verified_only' => $merged['verified_only'],
            'max_distance_km' => $merged['max_distance_km'],
            'updated_at' => now(),
            'created_at' => now(),
        ]);

        return response()->json($this->preferencesFor($user->id));
    }

    /**
     * @return array<string, mixed>
     *
     * @scramble-return array{seeking_genders: list<'man'|'woman'|'other'>, age_min: int, age_max: int, countries: list<string>, origins: list<string>, intents: list<'marriage'|'long_lasting_love'|'flirt'|'friendship'|'lets_find_out'>, verified_only: bool, max_distance_km: int|null}
     */
    private function preferencesFor(string $userId): array
    {
        $row = DB::table('preferences')->where('user_id', $userId)->first();
        $arr = fn ($v) => $v === null || $v === '{}' ? [] : array_values(array_filter(explode(',', trim($v, '{}')), 'strlen'));

        return [
            'seeking_genders' => $row ? $arr($row->seeking_genders) : [],
            'age_min' => $row->age_min ?? 18,
            'age_max' => $row->age_max ?? 99,
            'countries' => $row ? $arr($row->countries) : [],
            'origins' => $row ? $arr($row->origins) : [],
            'intents' => $row ? $arr($row->intents) : [],
            'verified_only' => (bool) ($row->verified_only ?? false),
            'max_distance_km' => $row->max_distance_km ?? null,
        ];
    }
}
