<?php

use App\Models\User;
use Illuminate\Database\QueryException;

it('émet un jeton Sanctum pour un utilisateur à clé uuid', function () {
    $user = User::factory()->create();
    expect($user->id)->toBeString()->toHaveLength(36);

    $token = $user->createToken('appareil-test')->plainTextToken;

    $this->withHeader('Authorization', 'Bearer '.$token)
        ->getJson('/api/v1/me')
        ->assertOk()
        ->assertJson(['id' => $user->id, 'email' => $user->email]);

    $this->assertDatabaseHas('personal_access_tokens', ['tokenable_id' => $user->id]);
});

it('refuse l’accès sans jeton', function () {
    $this->getJson('/api/v1/me')->assertUnauthorized();
});

it('ne permet pas de modifier la date de naissance', function () {
    $user = User::factory()->create();

    expect(fn () => $user->update(['birthdate' => '1980-01-01']))
        ->toThrow(QueryException::class);
});
