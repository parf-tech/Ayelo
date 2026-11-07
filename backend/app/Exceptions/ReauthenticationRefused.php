<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Refus de la ré-authentification exigée par la suppression et l'export de compte (revues F-20, F-21) : 403.
 *
 * Exception dédiée pour que le contrat OpenAPI décrive le refus sans inventer une réponse 200 vide
 * (voir `App\OpenApi\ReauthenticationExceptionResponses`).
 */
class ReauthenticationRefused extends RuntimeException
{
    public const WRONG_PASSWORD = 'invalid_credentials';

    public const WRONG_TOKEN = 'invalid_oauth_token';

    private function __construct(public readonly string $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public static function wrongPassword(): self
    {
        return new self(self::WRONG_PASSWORD, 'Mot de passe incorrect.');
    }

    public static function wrongToken(): self
    {
        return new self(self::WRONG_TOKEN, 'Ré-authentification refusée.');
    }

    public function render(): JsonResponse
    {
        return response()->json(['error' => ['code' => $this->errorCode, 'message' => $this->getMessage()]], 403);
    }
}
