<?php

// CORS restreint (lot infra pentest P-08/P-15) : seul le site public, et seulement pour la suppression de compte.

beforeEach(function () {
    config()->set('cors.allowed_origins', ['https://www.example.invalid']);
});

function preflight(object $test, string $path, string $origin, string $method = 'POST', string $headers = 'content-type')
{
    return $test->call('OPTIONS', $path, [], [], [], [
        'HTTP_ORIGIN' => $origin,
        'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => $method,
        'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => $headers,
    ]);
}

it('accepte la pré-requête du site public pour la demande de suppression', function () {
    $response = preflight($this, '/api/v1/account-deletion-requests', 'https://www.example.invalid');

    expect($response->getStatusCode())->toBeIn([200, 204]);
    expect($response->headers->get('Access-Control-Allow-Origin'))->toBe('https://www.example.invalid');
    expect($response->headers->get('Access-Control-Allow-Methods'))->toContain('POST');
    expect(strtolower((string) $response->headers->get('Access-Control-Allow-Headers')))->toContain('content-type');
    expect($response->headers->get('Access-Control-Allow-Credentials'))->toBeNull();
});

it('accepte aussi la pré-requête de confirmation', function () {
    $response = preflight($this, '/api/v1/account-deletion-requests/confirm', 'https://www.example.invalid');

    expect($response->headers->get('Access-Control-Allow-Origin'))->toBe('https://www.example.invalid');
});

it('refuse toute autre origine', function () {
    foreach (['https://evil.example.invalid', 'http://www.example.invalid', 'https://www.example.invalid.evil.invalid', 'null'] as $origin) {
        $response = preflight($this, '/api/v1/account-deletion-requests', $origin);

        // La bibliothèque peut annoncer l'unique origine autorisée ; le navigateur refuse si elle diffère de la sienne.
        // Jamais l'origine demandée n'est reflétée.
        expect($response->headers->get('Access-Control-Allow-Origin'))->not->toBe($origin, "origine $origin");
        expect($response->headers->get('Access-Control-Allow-Origin'))->not->toBe('*');
    }
});

it('refuse une méthode ou un en-tête non prévus', function () {
    $method = preflight($this, '/api/v1/account-deletion-requests', 'https://www.example.invalid', 'DELETE');
    $header = preflight($this, '/api/v1/account-deletion-requests', 'https://www.example.invalid', 'POST', 'authorization');

    expect((string) $method->headers->get('Access-Control-Allow-Methods'))->not->toContain('DELETE');
    expect((string) $method->headers->get('Access-Control-Allow-Methods'))->not->toContain('*');
    expect(strtolower((string) $header->headers->get('Access-Control-Allow-Headers')))->not->toContain('authorization');
});

it('ne pose aucun en-tête CORS sur le reste de l\'API, même pour le site public', function () {
    foreach (['/api/v1/health', '/api/v1/auth/login', '/api/v1/me'] as $path) {
        $response = preflight($this, $path, 'https://www.example.invalid');
        expect($response->headers->get('Access-Control-Allow-Origin'))->toBeNull("préflight $path");
    }

    $get = $this->getJson('/api/v1/health', ['Origin' => 'https://www.example.invalid']);
    expect($get->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});

it('pose l\'en-tête CORS sur la réponse réelle du site public, sans identifiants', function () {
    $response = $this->postJson('/api/v1/account-deletion-requests', ['email' => 'nobody@example.invalid'], ['Origin' => 'https://www.example.invalid']);

    expect($response->headers->get('Access-Control-Allow-Origin'))->toBe('https://www.example.invalid');
    expect($response->headers->get('Access-Control-Allow-Credentials'))->toBeNull();
});

it('ne déduit aucune origine quand rien n\'est configuré', function () {
    config()->set('cors.allowed_origins', []);
    $response = preflight($this, '/api/v1/account-deletion-requests', 'https://www.example.invalid');

    expect($response->headers->get('Access-Control-Allow-Origin'))->toBeNull();
});
