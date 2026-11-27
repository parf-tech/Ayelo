<?php

/*
 * Joue les quatre routes du banc une requête à la fois : un échauffement jeté, un passage chronométré sans profil, puis un
 * passage profilé (en-tête X-Profil, voir prepend.php). Usage : php requetes.php <acteurs.json> [requêtes par route]
 */
[, $file] = $argv;
$count = max(1, (int) ($argv[2] ?? 200));
$base = getenv('PROFIL_BASE') ?: 'http://web';
$actors = json_decode((string) file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
$talking = array_values(array_filter($actors, static fn (array $a): bool => $a['conversations'] !== []));
if ($talking === []) {
    fwrite(STDERR, "aucun acteur avec conversation\n");
    exit(1);
}

$uuid = static function (): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0F) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3F) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
};
$pick = static fn (array $list): array => $list[mt_rand(0, count($list) - 1)];
$conversation = static fn (array $a): string => $a['conversations'][mt_rand(0, count($a['conversations']) - 1)];

// route => fabrique de requête : [acteur, méthode, chemin, corps, code attendu]
$routes = [
    'decouverte' => static fn (): array => [$pick($actors), 'GET', '/api/v1/discover?limit=20', null, 200],
    'conversations' => static fn (): array => [$pick($actors), 'GET', '/api/v1/conversations?limit=50', null, 200],
    'fil' => static function () use ($pick, $conversation, $talking): array {
        $a = $pick($talking);

        return [$a, 'GET', '/api/v1/conversations/'.$conversation($a).'/messages', null, 200];
    },
    'envoi' => static function () use ($pick, $conversation, $talking, $uuid): array {
        $a = $pick($talking);
        $body = json_encode(['client_id' => $uuid(), 'type' => 'text', 'body' => 'Bonjour, message du banc de charge.']);

        return [$a, 'POST', '/api/v1/conversations/'.$conversation($a).'/messages', $body, 201];
    },
];

$curl = curl_init();
$play = static function (string $route, int $times, bool $profiled) use ($curl, $routes, $base): array {
    $durations = [];
    $failures = [];
    $bytes = 0;
    for ($i = 0; $i < $times; $i++) {
        [$actor, $method, $path, $body, $expected] = $routes[$route]();
        $headers = ['Authorization: Bearer '.$actor['token'], 'Accept: application/json', 'Content-Type: application/json'];
        if ($profiled) {
            $headers[] = 'X-Profil: '.$route;
        }
        curl_setopt_array($curl, [
            CURLOPT_URL => $base.$path, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_POSTFIELDS => $body ?? '',
            CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
        ]);
        $answer = curl_exec($curl);
        $code = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        if ($code !== $expected) {
            $failures[$code] = ($failures[$code] ?? 0) + 1;

            continue;
        }
        $durations[] = (float) curl_getinfo($curl, CURLINFO_TOTAL_TIME) * 1000;
        $bytes += strlen((string) $answer);
    }
    sort($durations);

    return [$durations, $failures, $bytes];
};
$at = static fn (array $sorted, float $q): float => $sorted === [] ? 0.0 : $sorted[(int) floor($q * (count($sorted) - 1))];

// PROFIL_ROUTE : une seule route (comparaison, comparer.sh). PROFIL_SANS=1 : pas de passage profilé.
$only = getenv('PROFIL_ROUTE') ?: null;
$selected = $only === null ? array_keys($routes) : [$only];
$profile = getenv('PROFIL_SANS') !== '1';

foreach ($selected as $route) {
    $play($route, 20, false);
}
printf("%-14s %6s %10s %10s %14s %12s %s\n", 'route', 'n', 'médiane ms', 'p95 ms', 'profilé méd.', 'réponse Ko', 'refus (code => nombre)');
foreach ($selected as $route) {
    mt_srand(1);
    [$plain, $failures, $bytes] = $play($route, $count, false);
    $profiled = [];
    if ($profile) {
        mt_srand(1);
        [$profiled] = $play($route, $count, true);
    }
    printf("%-14s %6d %10.1f %10.1f %14.1f %12.1f %s\n", $route, count($plain), $at($plain, 0.5), $at($plain, 0.95), $at($profiled, 0.5), $plain === [] ? 0 : $bytes / count($plain) / 1024, json_encode((object) $failures));
}
