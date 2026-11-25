<?php

/*
 | Troisième relecture ciblée de N-01 / N-02 (2026-11-24, docs/reviews/code-security-2-suivi.md).
 */

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

it('N-02 : deux contestations simultanées de la même sanction donnent un 409, pas un 500', function () {
    $user = User::factory()->create(['birthdate' => '1990-01-01', 'password' => Hash::make('Motdepasse2026'), 'status' => 'suspended']);
    $sanction = (string) Str::uuid();
    DB::table('sanctions')->insert(['id' => $sanction, 'user_id' => $user->id, 'kind' => 'suspension', 'reason' => 'spam', 'starts_at' => now(), 'created_at' => now()]);

    $token = $this->withHeader('X-Device-Id', (string) Str::uuid())
        ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Motdepasse2026', 'platform' => 'ios'])
        ->assertOk()->json('token');

    // La contestation concurrente s'insère juste avant celle de la requête testée.
    $raced = false;
    DB::beforeExecuting(function (string $query) use (&$raced, $sanction, $user) {
        if (! $raced && str_starts_with($query, 'insert into "appeals"')) {
            $raced = true;
            DB::table('appeals')->insert([
                'id' => (string) Str::uuid(), 'sanction_id' => $sanction, 'user_id' => $user->id,
                'message' => 'Contestation concurrente arrivée la première.', 'status' => 'open', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    });

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/v1/appeals', ['sanction_id' => $sanction, 'message' => 'Je conteste cette décision, ce message était légitime.'])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'already_appealed');

    expect($raced)->toBeTrue()->and(DB::table('appeals')->where('sanction_id', $sanction)->count())->toBe(1);
});
