<?php

it('répond ok quand la base est joignable', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertJson(['status' => 'ok', 'db' => 'ok']);
});
