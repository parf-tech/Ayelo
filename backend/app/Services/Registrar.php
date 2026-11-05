<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Création d'un compte : utilisateur, consentements, préférences de notification (une transaction).
 * Partagé par l'inscription par e-mail et par l'inscription via un fournisseur (Google, Apple).
 */
class Registrar
{
    /** Versions des textes acceptés (à synchroniser avec les pages légales). */
    public const CONSENT_VERSION = '2026-11-05';

    /**
     * @param  array{email: string, password?: string|null, birthdate: string, locale?: string|null, email_verified?: bool}  $attributes
     * @param  array{terms?: mixed, privacy?: mixed, sensitive_data?: mixed, marketing?: mixed}  $consents
     */
    public function create(array $attributes, array $consents, Request $request): User
    {
        return DB::transaction(function () use ($attributes, $consents, $request) {
            $user = new User([
                'email' => strtolower($attributes['email']),
                'password' => $attributes['password'] ?? null,
                'birthdate' => $attributes['birthdate'],
                'locale' => $attributes['locale'] ?? 'fr',
            ]);
            if (! empty($attributes['email_verified'])) {
                $user->email_verified_at = now();
            }
            $user->save();

            $rows = [];
            foreach (['terms', 'privacy', 'sensitive_data'] as $kind) {
                $rows[] = $this->consentRow($user->id, $kind, true, $request);
            }
            $rows[] = $this->consentRow($user->id, 'marketing', (bool) ($consents['marketing'] ?? false), $request);
            DB::table('user_consents')->insert($rows);

            DB::table('notification_prefs')->insert(['user_id' => $user->id, 'created_at' => now(), 'updated_at' => now()]);

            return $user;
        });
    }

    /** @return array<string, mixed> */
    private function consentRow(string $userId, string $kind, bool $granted, Request $request): array
    {
        return [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'kind' => $kind,
            'version' => self::CONSENT_VERSION,
            'granted' => $granted,
            'ip' => $request->ip(),
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
