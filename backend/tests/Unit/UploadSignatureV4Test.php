<?php

// Revue pentest P-07 : URL présignée de dépôt qui lie le type et la taille de l'objet (media.sign_upload_headers).
// Essai réel contre R2 le 2026-11-19 : le stockage n'accepte la signature que si la requête canonique se termine par la charge
// `UNSIGNED-PAYLOAD`, exactement comme avec le client S3 par défaut (Aws\Signature\S3SignatureV4). Une signature générique
// (Aws\Signature\SignatureV4) hache le corps vide à la place : R2 répond 403 SignatureDoesNotMatch même pour une requête correcte.
// Aucune base ni aucun réseau ici : le SDK est exercé seul, la signature attendue est recalculée sans lui, d'après la spécification SigV4.

use App\Services\Storage\UploadSignatureV4;
use Aws\S3\S3Client;

const UPLOAD_SIG_KEY = 'AKIATESTTESTTEST';
const UPLOAD_SIG_SECRET = 'secrettest';
const UPLOAD_SIG_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
const UPLOAD_SIG_PATH = '/media-prod/u/42/profile_photo/abc.jpg';

/** @return array<string, string> Paramètres de requête de l'URL présignée de dépôt, tels que le client de production les produit (heure fixée : résultat reproductible). */
function uploadPresignedQuery(string $mime, int $size): array
{
    $client = new S3Client([
        'version' => 'latest',
        'region' => 'auto',
        'endpoint' => UPLOAD_SIG_ENDPOINT,
        'use_path_style_endpoint' => true,
        'credentials' => ['key' => UPLOAD_SIG_KEY, 'secret' => UPLOAD_SIG_SECRET],
        'signature_provider' => fn (string $version, string $service, string $region) => new UploadSignatureV4($service, $region),
    ]);
    $command = $client->getCommand('PutObject', ['Bucket' => 'media-prod', 'Key' => 'u/42/profile_photo/abc.jpg', 'ContentType' => $mime, 'ContentLength' => $size]);
    parse_str($client->createPresignedRequest($command, '+5 minutes', ['start_time' => 1_800_000_000])->getUri()->getQuery(), $query);

    return $query;
}

/** Signature SigV4 (requête en paramètres, charge non signée) recalculée sans le SDK. */
function expectedUploadSignature(array $query, array $headers): string
{
    $enc = fn (string $s) => str_replace('%7E', '~', rawurlencode($s));
    unset($query['X-Amz-Signature']);
    ksort($query);
    $canonicalQuery = implode('&', array_map(fn ($k, $v) => $enc((string) $k).'='.$enc((string) $v), array_keys($query), $query));
    $headers['host'] = parse_url(UPLOAD_SIG_ENDPOINT, PHP_URL_HOST);
    ksort($headers);
    $canonicalHeaders = '';
    foreach ($headers as $name => $value) {
        $canonicalHeaders .= $name.':'.$value."\n";
    }
    $path = implode('/', array_map($enc, explode('/', UPLOAD_SIG_PATH)));
    $canonicalRequest = "PUT\n{$path}\n{$canonicalQuery}\n{$canonicalHeaders}\n".implode(';', array_keys($headers))."\nUNSIGNED-PAYLOAD";

    $date = substr($query['X-Amz-Date'], 0, 8);
    $scope = "{$date}/auto/s3/aws4_request";
    $stringToSign = "AWS4-HMAC-SHA256\n{$query['X-Amz-Date']}\n{$scope}\n".hash('sha256', $canonicalRequest);
    $key = hash_hmac('sha256', 'aws4_request', hash_hmac('sha256', 's3', hash_hmac('sha256', 'auto', hash_hmac('sha256', $date, 'AWS4'.UPLOAD_SIG_SECRET, true), true), true), true);

    return hash_hmac('sha256', $stringToSign, $key);
}

it('signe content-length, content-type et host, avec la charge UNSIGNED-PAYLOAD comme le client S3 par défaut', function () {
    $query = uploadPresignedQuery('image/jpeg', 1234);

    expect($query['X-Amz-SignedHeaders'])->toBe('content-length;content-type;host')
        ->and($query['X-Amz-Content-Sha256'])->toBe('UNSIGNED-PAYLOAD');
});

it('produit la signature SigV4 standard, celle que le stockage recalcule (R2 refusait sinon même une requête correcte)', function () {
    $query = uploadPresignedQuery('image/jpeg', 1234);

    expect($query['X-Amz-Signature'])->toBe(expectedUploadSignature($query, ['content-length' => '1234', 'content-type' => 'image/jpeg']));
});

it('lie la signature au type et à la taille déclarés', function () {
    $signature = fn (string $mime, int $size) => uploadPresignedQuery($mime, $size)['X-Amz-Signature'];

    expect($signature('image/jpeg', 1234))->toBe($signature('image/jpeg', 1234))
        ->and($signature('image/jpeg', 1234))->not->toBe($signature('image/png', 1234))
        ->and($signature('image/jpeg', 1234))->not->toBe($signature('image/jpeg', 1235));
});
