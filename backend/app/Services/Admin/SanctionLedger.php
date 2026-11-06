<?php

namespace App\Services\Admin;

use App\Models\User;
use App\Services\DeviceSessions;
use Carbon\CarbonInterface;
use DomainException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Écritures communes de sanctions (signalements, contestations, actions manuelles sur un utilisateur).
 * Usage interne : n'écrit PAS dans le journal d'audit, l'appelant est un AdminService::audited() qui le fait
 * dans la même transaction.
 *
 * La sanction est la notification faite à l'utilisateur : l'API la liste (GET /me/sanctions) et permet de la contester.
 */
class SanctionLedger
{
    /** Statuts depuis lesquels une sanction peut être posée (pas de sanction sur un compte en cours de suppression). */
    private const SANCTIONABLE = ['active', 'suspended', 'banned'];

    public function __construct(private DeviceSessions $sessions) {}

    /** @return Collection<int, object> sanctions de restriction (suspension, bannissement) en vigueur */
    public function activeRestrictions(string $userId): Collection
    {
        return DB::table('sanctions')
            ->where('user_id', $userId)
            ->whereIn('kind', ['suspension', 'ban'])
            ->where('starts_at', '<=', self::ts())
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>', self::ts()))
            ->get();
    }

    /**
     * Pose une sanction. Une suspension ou un bannissement remplace les restrictions en vigueur,
     * met le compte à jour et ferme les sessions.
     *
     * @return string identifiant de la sanction
     */
    public function issue(string $userId, string $kind, string $reason, ?string $reportId, ?CarbonInterface $endsAt, ?string $staffId): string
    {
        $user = DB::table('users')->where('id', $userId)->lockForUpdate()->first();
        if ($user === null || ! in_array($user->status, self::SANCTIONABLE, true)) {
            throw new DomainException('Ce compte ne peut pas être sanctionné (inexistant, en suppression ou supprimé).');
        }
        if ($kind !== 'warning' && $user->status === 'banned') {
            throw new DomainException('Ce compte est déjà banni.');
        }

        if ($kind !== 'warning') {
            foreach ($this->activeRestrictions($userId) as $existing) {
                $this->close($existing);
            }
        }

        $id = (string) Str::uuid();
        DB::table('sanctions')->insert([
            'id' => $id, 'user_id' => $userId, 'kind' => $kind, 'reason' => $reason, 'report_id' => $reportId,
            'starts_at' => self::ts(), 'ends_at' => $endsAt === null ? null : self::ts($endsAt), 'created_by' => $staffId, 'created_at' => self::ts(),
        ]);

        if ($kind !== 'warning') {
            // Les jetons ne sont PAS révoqués : le middleware EnsureAccountActive restreint déjà l'accès, et l'utilisateur doit
            // pouvoir lire sa sanction et la contester (revue N-02).
            DB::table('users')->where('id', $userId)->update(['status' => $kind === 'ban' ? 'banned' : 'suspended', 'updated_at' => now()]);
        }

        return $id;
    }

    /** Termine une sanction en vigueur (la ligne est conservée : historique). */
    public function close(object $sanction): void
    {
        DB::table('sanctions')->where('id', $sanction->id)->update(['ends_at' => self::ts($this->closingTime($sanction->starts_at))]);
    }

    /**
     * Remet le compte en « active » si plus aucune restriction n'est en vigueur.
     *
     * @return bool vrai si le statut a changé
     */
    public function restoreIfFree(string $userId): bool
    {
        if ($this->activeRestrictions($userId)->isNotEmpty()) {
            return false;
        }

        return DB::table('users')->where('id', $userId)->whereIn('status', ['suspended', 'banned'])
            ->update(['status' => 'active', 'updated_at' => now()]) > 0;
    }

    /**
     * Réactive les comptes dont la suspension a expiré (ends_at passé, plus aucune restriction en vigueur).
     * Appelé par la commande `sanctions:expire`, à planifier (ex. chaque minute).
     *
     * @return int nombre de comptes réactivés
     */
    public function restoreExpired(): int
    {
        $restored = 0;
        foreach (DB::table('users')->where('status', 'suspended')->pluck('id') as $userId) {
            $hasSanction = DB::table('sanctions')->where('user_id', $userId)->whereIn('kind', ['suspension', 'ban'])->exists();
            if ($hasSanction && $this->restoreIfFree($userId)) {
                $restored++;
                // Réactivation automatique tracée (revue N-13) : acteur nul = le système.
                app(Audit::class)->record(null, 'sanction.expired', 'users', $userId, ['status' => 'suspended'], ['status' => 'active']);
            }
        }

        return $restored;
    }

    /** Horodatage à la microseconde : une sanction posée puis levée dans la même seconde reste cohérente (ends_at > starts_at). */
    public static function ts(?CarbonInterface $at = null): string
    {
        return ($at ?? now())->format('Y-m-d H:i:s.uP');
    }

    /** Contrainte SQL : ends_at > starts_at. */
    private function closingTime(mixed $startsAt): CarbonInterface
    {
        $starts = Carbon::parse($startsAt);

        return now()->greaterThan($starts) ? now() : $starts->copy()->addMicrosecond();
    }

    private function revokeSessions(string $userId): void
    {
        if ($user = User::find($userId)) {
            $this->sessions->revokeAll($user);
        }
    }
}
