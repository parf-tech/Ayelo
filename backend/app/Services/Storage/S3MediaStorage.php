<?php

namespace App\Services\Storage;

use Aws\Exception\AwsException;
use Aws\S3\S3Client;

class S3MediaStorage implements MediaStorage
{
    private ?S3Client $client = null;

    private ?S3Client $uploadClient = null;

    private function client(): S3Client
    {
        return $this->client ??= new S3Client([
            'version' => 'latest',
            'region' => config('media.disk.region'),
            'endpoint' => config('media.disk.endpoint'),
            'use_path_style_endpoint' => true,
            'credentials' => ['key' => (string) config('media.disk.key'), 'secret' => (string) config('media.disk.secret')],
        ]);
    }

    /**
     * Client dédié à la présignature du dépôt quand `media.sign_upload_headers` est actif : SigV4 qui signe `content-length` et
     * `content-type` (UploadSignatureV4). Séparé du client ordinaire pour ne pas changer la signature des autres requêtes.
     */
    private function uploadClient(): S3Client
    {
        return $this->uploadClient ??= new S3Client([
            'version' => 'latest',
            'region' => config('media.disk.region'),
            'endpoint' => config('media.disk.endpoint'),
            'use_path_style_endpoint' => true,
            'credentials' => ['key' => (string) config('media.disk.key'), 'secret' => (string) config('media.disk.secret')],
            'signature_provider' => fn (string $version, string $service, string $region) => new UploadSignatureV4($service, $region),
        ]);
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

    public function temporaryUrl(string $key, int $ttlMinutes): string
    {
        $command = $this->client()->getCommand('GetObject', ['Bucket' => config('media.disk.bucket'), 'Key' => $key]);

        return (string) $this->client()->createPresignedRequest($command, "+{$ttlMinutes} minutes")->getUri();
    }

    public function head(string $key): ?array
    {
        try {
            $result = $this->client()->headObject(['Bucket' => config('media.disk.bucket'), 'Key' => $key]);
        } catch (AwsException) {
            return null;
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
