<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Illuminate\Support\Facades\DB;

/**
 * Journal d'audit unique (FR-H-7). Toute action d'administration passe par ici :
 * - les services d'administration l'appellent dans la MÊME transaction que l'action (AdminService::audited) ;
 *   si l'écriture du journal échoue, l'action est annulée ;
 * - la table `audit_logs` est en ajout seulement (déclencheur SQL) ;
 * - les champs sensibles sont retirés avant écriture : aucun secret n'entre dans le journal.
 */
class Audit
{
    /** Clés jamais écrites, quel que soit le niveau d'imbrication. */
    private const SECRET_KEYS = ['password', 'passwordconfirmation', 'currentpassword', 'totp', 'secret', 'recovery', 'token', 'code_hash', 'remember'];

    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function record(?StaffUser $actor, string $action, ?string $subjectType = null, ?string $subjectId = null, ?array $before = null, ?array $after = null): void
    {
        DB::table('audit_logs')->insert([
            'actor_staff_id' => $actor?->getKey(),
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId,
            'before' => $before === null ? null : json_encode($this->redact($before), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'after' => $after === null ? null : json_encode($this->redact($after), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'ip' => $this->ip(),
            'created_at' => now(),
        ]);
    }

    /** @param  array<mixed>  $data  @return array<mixed> */
    public function redact(array $data): array
    {
        foreach ($data as $key => $value) {
            if (is_string($key) && $this->isSecretKey($key)) {
                $data[$key] = '[masqué]';
            } elseif (is_array($value)) {
                $data[$key] = $this->redact($value);
            }
        }

        return $data;
    }

    private function isSecretKey(string $key): bool
    {
        $key = strtolower($key);
        foreach (self::SECRET_KEYS as $secret) {
            if (str_contains($key, $secret)) {
                return true;
            }
        }

        return false;
    }

    private function ip(): ?string
    {
        $ip = app()->runningInConsole() && ! app()->runningUnitTests() ? null : request()->ip();

        return $ip !== null && filter_var($ip, FILTER_VALIDATE_IP) ? $ip : null;
    }
}
