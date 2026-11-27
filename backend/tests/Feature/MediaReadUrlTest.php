<?php

use App\Services\Storage\S3MediaStorage;
use Aws\S3\S3Client;
use Illuminate\Support\Carbon;

/*
 * Adresses de lecture des médias. Une liste en signe des dizaines : elles sont signées directement (signeur SigV4 du SDK),
 * sans client S3 ni chaîne de commande. Référence : l'adresse que produit le client S3 lui-même, à la même heure.
 * Aucun réseau.
 */

const LECTURE_HEURE = 1_800_000_000;

function disqueDEssai(string $region, string $endpoint): array
{
    return ['endpoint' => $endpoint, 'bucket' => 'media-prod', 'key' => 'AKIATESTTESTTEST', 'secret' => 'secrettest', 'region' => $region];
}

/** Adresse de lecture produite par le client S3, avec les réglages de l'application. */
function adresseDuClientS3(string $key, int $minutes): string
{
    $disk = config('media.disk');
    $client = new S3Client([
        'version' => 'latest',
        'region' => $disk['region'],
        'endpoint' => $disk['endpoint'],
        'use_path_style_endpoint' => true,
        'credentials' => ['key' => $disk['key'], 'secret' => $disk['secret']],
    ]);
    $command = $client->getCommand('GetObject', ['Bucket' => $disk['bucket'], 'Key' => $key]);

    return (string) $client->createPresignedRequest($command, LECTURE_HEURE + $minutes * 60, ['start_time' => LECTURE_HEURE])->getUri();
}

beforeEach(function () {
    Carbon::setTestNow(Carbon::createFromTimestamp(LECTURE_HEURE));
});

it('signe la même adresse de lecture que le client S3', function (string $key, string $region, string $endpoint) {
    config(['media.disk' => disqueDEssai($region, $endpoint)]);

    expect((new S3MediaStorage)->temporaryUrl($key, 10))->toBe(adresseDuClientS3($key, 10));
})->with([
    'photo de profil (R2)' => ['u/3f2b8c1e-9a4d-4f6e-8b2a-1c3d5e7f9a0b/profile_photo/9d1c.jpg', 'auto', 'https://acct.r2.cloudflarestorage.com'],
    'caractères à coder' => ['u/42/été (copie)+1~x=y&z.jpg', 'auto', 'https://acct.r2.cloudflarestorage.com'],
    'autre région, barre finale' => ['u/42/message_voice/a.m4a', 'eu-west-3', 'https://s3.exemple.test/'],
    'faux stockage du banc (port)' => ['u/42/profile_photo/a.jpg', 'auto', 'http://s3:9090'],
]);

it('respecte la durée demandée', function () {
    config(['media.disk' => disqueDEssai('auto', 'https://acct.r2.cloudflarestorage.com')]);

    parse_str((string) parse_url((new S3MediaStorage)->temporaryUrl('u/42/a.jpg', 3), PHP_URL_QUERY), $query);

    expect($query['X-Amz-Expires'])->toBe('180')->and($query)->toHaveKeys(['X-Amz-Signature', 'X-Amz-Credential', 'X-Amz-Date']);
});

it('change de signature quand la clé de stockage change', function () {
    config(['media.disk' => disqueDEssai('auto', 'https://acct.r2.cloudflarestorage.com')]);
    $avant = (new S3MediaStorage)->temporaryUrl('u/42/a.jpg', 10);

    config(['media.disk.secret' => 'autre-secret']);

    expect((new S3MediaStorage)->temporaryUrl('u/42/a.jpg', 10))->not->toBe($avant);
});
