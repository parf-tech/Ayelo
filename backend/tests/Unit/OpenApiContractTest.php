<?php

// Garde-fous sur docs/openapi.json (le contrat dont le mobile génère ses types). Lecture du fichier seule : aucune base requise.
// La fraîcheur du fichier est vérifiée à part par la CI (`scramble:export` puis `git diff --exit-code`).

function openApiContract(): array
{
    return json_decode(file_get_contents(dirname(__DIR__, 3).'/docs/openapi.json'), true, 512, JSON_THROW_ON_ERROR);
}

/** @return iterable<string, array{0: string, 1: string, 2: array}> */
function openApiOperations(): iterable
{
    foreach (openApiContract()['paths'] as $path => $methods) {
        foreach ($methods as $method => $operation) {
            yield strtoupper($method).' '.$path => [$method, $path, $operation];
        }
    }
}

it('ne décrit aucune réponse de succès vide, nulle ou sans propriétés (« type: null », objet nu)', function () {
    $bad = [];
    foreach (openApiOperations() as $label => [, , $operation]) {
        foreach ($operation['responses'] as $status => $response) {
            if (! str_starts_with((string) $status, '2') || ! isset($response['content']['application/json'])) {
                continue; // 202 / 204 sans corps : pas de contenu déclaré, c'est voulu
            }
            $schema = $response['content']['application/json']['schema'] ?? null;
            $empty = $schema === null
                || ($schema['type'] ?? null) === 'null'
                || (($schema['type'] ?? null) === 'object' && ! isset($schema['properties']) && ! isset($schema['additionalProperties']));
            if ($empty) {
                $bad[] = "$label $status";
            }
        }
    }

    expect($bad)->toBe([]);
});

it('décrit un corps JSON pour chaque opération qui lit un corps de requête', function () {
    $contract = openApiContract();
    foreach (['/me' => 'delete', '/me/export' => 'post', '/broadcasting/auth' => 'post'] as $path => $method) {
        $operation = $contract['paths'][$path][$method] ?? null;
        expect($operation)->not->toBeNull("$method $path absent du contrat");
        expect($operation['requestBody']['content']['application/json']['schema'] ?? null)->not->toBeNull("$method $path sans corps décrit");
    }
});

it('décrit la ré-authentification sans mot de passe dans l’adresse', function () {
    $delete = openApiContract()['paths']['/me']['delete'];

    expect($delete)->not->toHaveKey('parameters');
    $variants = $delete['requestBody']['content']['application/json']['schema']['anyOf'];
    expect($variants)->toHaveCount(2)
        ->and($variants[0]['required'])->toBe(['password'])
        ->and($variants[1]['required'])->toBe(['provider', 'id_token'])
        ->and($variants[1]['properties'])->toHaveKey('nonce');
});

it('documente les refus de ré-authentification (403, 429) et le 202 de la suppression et de l’export', function () {
    $contract = openApiContract();
    foreach ([['/me', 'delete'], ['/me/export', 'post']] as [$path, $method]) {
        $responses = $contract['paths'][$path][$method]['responses'];
        expect(array_keys($responses))->toContain(202, 403, 429)->not->toContain(200);
    }
});

it('documente le 403 conversation_closed à l’ouverture d’une conversation, à côté du 402 et du 409', function () {
    $responses = openApiContract()['paths']['/conversations']['post']['responses'];

    expect(array_keys($responses))->toContain(200, 201, 402, 403, 409);
    expect(json_encode($responses['403']))->toContain('conversation_closed');
});

it('limite /broadcasting/auth à POST avec socket_id, channel_name et la réponse { auth }', function () {
    $operations = openApiContract()['paths']['/broadcasting/auth'];

    expect(array_keys($operations))->toBe(['post']);
    $body = $operations['post']['requestBody']['content']['application/json']['schema'];
    expect($body['required'])->toBe(['socket_id', 'channel_name']);
    $ok = $operations['post']['responses']['200']['content']['application/json']['schema'];
    expect($ok['required'])->toBe(['auth'])->and($ok['properties'])->toHaveKey('channel_data');
});
