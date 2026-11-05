<?php

namespace App\Services;

use App\Events\MatchCreated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SwipeService
{
    /**
     * Enregistre un swipe et crée le match si l'autre personne avait déjà aimé.
     *
     * Concurrence : deux likes réciproques simultanés ne se voient pas en READ COMMITTED. On sérialise donc
     * les deux transactions de la paire avec un verrou consultatif de transaction ; le second voit alors
     * le swipe du premier et crée le match (exactement un, grâce à l'index unique).
     *
     * @return array{status: string, matched: bool, match_id?: string, conversation_id?: string}
     */
    public function swipe(string $swiperId, string $targetId, string $action): array
    {
        $result = DB::transaction(function () use ($swiperId, $targetId, $action) {
            $pair = [$swiperId, $targetId];
            sort($pair, SORT_STRING);
            DB::select('select pg_advisory_xact_lock(hashtextextended(?, 0))', [$pair[0].'|'.$pair[1]]);

            $existing = DB::table('swipes')->where('swiper_id', $swiperId)->where('target_id', $targetId)->first();
            if ($existing) {
                return array_merge(['status' => 'already_swiped', 'matched' => false], $this->existingMatch($pair));
            }

            DB::table('swipes')->insert([
                'id' => (string) Str::uuid(), 'swiper_id' => $swiperId, 'target_id' => $targetId, 'action' => $action,
                'created_at' => now(), 'updated_at' => now(),
            ]);

            if ($action === 'dislike') {
                return ['status' => 'recorded', 'matched' => false];
            }

            $reciprocal = DB::table('swipes')->where('swiper_id', $targetId)->where('target_id', $swiperId)->whereIn('action', ['like', 'super_like'])->exists();
            if (! $reciprocal) {
                return ['status' => 'recorded', 'matched' => false];
            }

            $matchId = (string) Str::uuid();
            DB::table('matches')->insertOrIgnore([
                'id' => $matchId, 'user_a' => $pair[0], 'user_b' => $pair[1], 'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $match = DB::table('matches')->where('user_a', $pair[0])->where('user_b', $pair[1])->first();

            DB::table('conversations')->insertOrIgnore([
                'id' => (string) Str::uuid(), 'user_a' => $pair[0], 'user_b' => $pair[1], 'match_id' => $match->id,
                'initiated_by' => $swiperId, 'unlocked_by' => 'match', 'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
            ]);
            $conversation = DB::table('conversations')->where('user_a', $pair[0])->where('user_b', $pair[1])->first();

            return [
                'status' => 'recorded', 'matched' => true, 'match_id' => $match->id, 'conversation_id' => $conversation->id,
                'created' => $match->id === $matchId, 'pair' => $pair,
            ];
        });

        // La diffusion se fait après le commit pour ne jamais annoncer un match annulé.
        if (($result['created'] ?? false) === true) {
            MatchCreated::dispatch($result['match_id'], $result['conversation_id'], $result['pair'][0], $result['pair'][1]);
        }
        unset($result['created'], $result['pair']);

        return $result;
    }

    /** @param array{0: string, 1: string} $pair @return array<string, mixed> */
    private function existingMatch(array $pair): array
    {
        $match = DB::table('matches')->where('user_a', $pair[0])->where('user_b', $pair[1])->where('status', 'active')->first();
        if (! $match) {
            return [];
        }
        $conversation = DB::table('conversations')->where('match_id', $match->id)->first();

        return ['matched' => true, 'match_id' => $match->id, 'conversation_id' => $conversation?->id];
    }
}
