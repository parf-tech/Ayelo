<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Identifiant d'installation envoyé par l'application (en-tête X-Device-Id, uuid).
 * Il sert à limiter le débit et à mémoriser un refus d'âge. On ne stocke que son empreinte HMAC.
 */
final class DeviceId
{
    public static function from(Request $request): string
    {
        $id = (string) $request->header('X-Device-Id', '');

        if (! Str::isUuid($id)) {
            throw ValidationException::withMessages(['device' => ['En-tête X-Device-Id (uuid) obligatoire.']]);
        }

        return strtolower($id);
    }

    public static function hash(string $deviceId): string
    {
        return hash_hmac('sha256', $deviceId, (string) config('app.key'));
    }
}
