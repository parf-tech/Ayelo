<?php

namespace App\Services\Storage;

use Aws\Credentials\Credentials;
use Aws\Exception\AwsException;
use Aws\S3\S3Client;
use Aws\Signature\S3SignatureV4;
use GuzzleHttp\Psr7\Request;

class S3MediaStorage implements MediaStorage
{
    private ?S3Client $client = null;

    private ?S3Client $uploadClient = null;

    /** @param  array<string, mixed>  $clientOptions  Options ajoutées au client S3 (les tests y passent un `handler` simulé). */
    public function __construct(private array $clientOptions = []) {}

    /** @return array<string, mixed> */
    private function baseOptions(): array
    {
        return array_replace([
            'version' => 'latest',
            'region' => config('media.disk.region'),
            'endpoint' => config('media.disk.endpoint'),
            'use_path_style_endpoint' => true,
            'credentials' => ['key' => (string) config('media.disk.key'), 'secret' => (string) config('media.disk.secret')],
            // Délais de connexion et de réponse, et nombre de nouvelles tentatives : (1 + retries) x timeout reste sous le
            // `request_terminate_timeout` de PHP-FPM. Un stockage lent ne doit pas immobiliser un processus.
            'http' => config('media.http'),
            'retries' => (int) config('media.retries'),
        ], $this->clientOptions);
    }

    private function client(): S3Client
    {
        return $this->client ??= new S3Client($this->baseOptions());
    }

    /**
     * Client dédié à la présignature du dépôt quand `media.sign_upload_headers` est actif : SigV4 qui signe `content-length` et
     * `content-type` (UploadSignatureV4). Séparé du client ordinaire pour ne pas changer la signature des autres requêtes.
     */
    private function uploadClient(): S3Client
    {
        return $this->uploadClient ??= new S3Client(array_replace($this->baseOptions(), [
            'signature_provider' => fn (string $version, string $service, string $region) => new UploadSignatureV4($service, $region),
        ]));
    }

    public function presignedUpload(string $key, string $mime, int $size, int $ttlMinutes): array
    {
        // Revue pentest P-07 : par défaut le SDK ne signe NI `content-length` NI `content-type` dans une URL présignée (SignatureV4::
        // getHeaderBlacklist et getPresignHeaderDenyList) : la taille déclarée ($size) n'est alors pas liée à l'URL. Deux défenses :
        //  1. `media.sign_upload_headers` (MEDIA_SIGN_UPLOAD_HEADERS=true) signe les deux en-têtes ; le client doit envoyer exactement
        //     ce Content-Type et un corps de $size octets (son Content-Length). À activer après essai sur le stockage réel (R2).
        //  2. Toujours : `media:purge-oversized` (toutes les 5 minutes) supprime tout dépôt en attente plus gros que le plafond du
        //     type ou que la taille déclarée, et `complete` refuse les mêmes cas.
        // Reste (réglage désactivé) : un objet hors norme existe quelques minutes (durée de l'URL : media.upload_ttl_minutes) ; un
        // plafond de taille d'objet et une règle de cycle de vie courte sur `u/` côté bucket le bornent.
        $signed = (bool) config('media.sign_upload_headers');
        $client = $signed ? $this->uploadClient() : $this->client();
        $args = ['Bucket' => config('media.disk.bucket'), 'Key' => $key, 'ContentType' => $mime];
        if ($signed) {
            $args['ContentLength'] = $size;
        }

        $request = $client->createPresignedRequest($client->getCommand('PutObject', $args), "+{$ttlMinutes} minutes");

        return ['url' => (string) $request->getUri(), 'headers' => ['Content-Type' => $mime]];
    }

    /**
     * Signature directe (signeur SigV4 du SDK) de l'adresse « chemin » `<endpoint>/<bucket>/<clé>`. Une liste signe une adresse
     * par photo : passer par un client S3 et sa chaîne de commande prenait environ une milliseconde par adresse, soit un sixième
     * du temps de la découverte (profil du banc de charge). `MediaReadUrlTest` compare le résultat à celui du client S3.
     */
    public function temporaryUrl(string $key, int $ttlMinutes): string
    {
        $options = $this->baseOptions();
        $url = rtrim((string) $options['endpoint'], '/')
            .'/'.rawurlencode((string) config('media.disk.bucket'))
            .'/'.str_replace('%2F', '/', rawurlencode($key));
        $now = now()->getTimestamp();

        $signed = (new S3SignatureV4('s3', (string) $options['region']))->presign(
            new Request('GET', $url),
            new Credentials($options['credentials']['key'], $options['credentials']['secret']),
            $now + $ttlMinutes * 60,
            ['start_time' => $now],
        );

        return (string) $signed->getUri();
    }

    public function head(string $key): ?array
    {
        try {
            $result = $this->client()->headObject(['Bucket' => config('media.disk.bucket'), 'Key' => $key]);
        } catch (AwsException $e) {
            // Seul « l'objet n'existe pas » vaut null. Un refus d'accès (mauvaise clé), une panne ou un délai dépassé remontent :
            // sinon ils passeraient pour un dépôt manquant (422 « fichier introuvable ») sans que personne ne voie la cause.
            if ($e->getStatusCode() === 404 || in_array($e->getAwsErrorCode(), ['NotFound', 'NoSuchKey'], true)) {
                return null;
            }

            throw $e;
        }

        return ['size' => (int) $result['ContentLength'], 'mime' => (string) $result['ContentType']];
    }

    public function delete(string $key): void
    {
        $this->client()->deleteObject(['Bucket' => config('media.disk.bucket'), 'Key' => $key]);
    }

    public function get(string $key, ?int $maxBytes = null): string
    {
        $args = ['Bucket' => config('media.disk.bucket'), 'Key' => $key];
        if ($maxBytes !== null) {
            $args['Range'] = 'bytes=0-'.$maxBytes;
        }

        return (string) $this->client()->getObject($args)['Body'];
    }

    public function put(string $key, string $contents, string $mime): void
    {
        $this->client()->putObject(['Bucket' => config('media.disk.bucket'), 'Key' => $key, 'Body' => $contents, 'ContentType' => $mime]);
    }

    public function listObjects(string $prefix): iterable
    {
        $pages = $this->client()->getPaginator('ListObjectsV2', ['Bucket' => config('media.disk.bucket'), 'Prefix' => $prefix]);
        foreach ($pages as $page) {
            foreach ($page['Contents'] ?? [] as $object) {
                yield ['key' => (string) $object['Key'], 'modified_at' => $object['LastModified']->getTimestamp()];
            }
        }
    }
}
