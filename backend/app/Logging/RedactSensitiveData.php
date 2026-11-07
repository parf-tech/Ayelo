<?php

namespace App\Logging;

use Monolog\LogRecord;
use Monolog\Processor\ProcessorInterface;

/**
 * Processeur Monolog : masque les données personnelles et les secrets avant écriture (adresses e-mail, jetons porteurs,
 * clés de contexte password/token/secret, longues chaînes hexadécimales ou base64). Appliqué à tous les canaux par
 * {@see RedactLogs} (option `tap` de config/logging.php). Les exceptions du contexte restent intactes (trace nécessaire au diagnostic).
 */
class RedactSensitiveData implements ProcessorInterface
{
    public const MASK = '[masqué]';

    /** Fragments de nom de clé dont la valeur est toujours masquée. */
    private const SENSITIVE_KEYS = ['password', 'passwd', 'token', 'secret', 'authorization', 'api_key', 'apikey', 'private_key', 'cookie'];

    public function __invoke(LogRecord $record): LogRecord
    {
        return $record->with(
            message: $this->scrubString($record->message),
            context: $this->scrubArray($record->context),
            extra: $this->scrubArray($record->extra),
        );
    }

    public function scrubString(string $value): string
    {
        // Jetons porteurs et schémas d'autorisation (Bearer, Basic).
        $value = preg_replace('/\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+\/]+=*/i', '$1 '.self::MASK, $value) ?? $value;
        // Jetons Sanctum « id|secret ».
        $value = preg_replace('/\b\d+\|[A-Za-z0-9]{20,}\b/', self::MASK, $value) ?? $value;
        // Adresses e-mail.
        $value = preg_replace('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+/', self::MASK, $value) ?? $value;
        // Longues chaînes hexadécimales (32 caractères ou plus) : clés, condensats, secrets.
        $value = preg_replace('/\b[A-Fa-f0-9]{32,}\b/', self::MASK, $value) ?? $value;
        // Longues chaînes base64 / base64url (40 caractères ou plus, avec chiffre, minuscule et majuscule : épargne chemins et noms) : jetons, clés.
        $value = preg_replace('/(?<![A-Za-z0-9+\/_\-])(?=[A-Za-z0-9+\/_\-]*\d)(?=[A-Za-z0-9+\/_\-]*[A-Z])(?=[A-Za-z0-9+\/_\-]*[a-z])[A-Za-z0-9+\/_\-]{40,}={0,2}(?![A-Za-z0-9+\/_\-])/', self::MASK, $value) ?? $value;

        return $value;
    }

    /**
     * @param  array<array-key, mixed>  $data
     * @return array<array-key, mixed>
     */
    private function scrubArray(array $data, int $depth = 0): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && $this->isSensitiveKey($key)) {
                $data[$key] = self::MASK;
            } elseif (is_string($value)) {
                $data[$key] = $this->scrubString($value);
            } elseif (is_array($value)) {
                $data[$key] = $depth >= 8 ? self::MASK : $this->scrubArray($value, $depth + 1);
            } elseif ($value instanceof \Stringable && ! $value instanceof \Throwable) {
                $data[$key] = $this->scrubString((string) $value);
            }
        }

        return $data;
    }

    private function isSensitiveKey(string $key): bool
    {
        $key = strtolower($key);
        foreach (self::SENSITIVE_KEYS as $needle) {
            if (str_contains($key, $needle)) {
                return true;
            }
        }

        return false;
    }
}
