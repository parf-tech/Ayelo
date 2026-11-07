<?php

namespace App\Services\Storage;

use Aws\Exception\AwsException;
use Aws\S3\S3Client;

class S3MediaStorage implements MediaStorage
{
    private ?S3Client $client = null;

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

    public function presignedUpload(string $key, string $mime, int $size, int $ttlMinutes): array
    {
        $command = $this->client()->getCommand('PutObject', [
            'Bucket' => config('media.disk.bucket'),
            'Key' => $key,
            'ContentType' => $mime,
            'ContentLength' => $size,
        ]);

        $request = $this->client()->createPresignedRequest($command, "+{$ttlMinutes} minutes");

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
