<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Closure;
use Illuminate\Support\Facades\DB;

/**
 * Base des services d'administration. Le seul moyen d'écrire est `audited()` :
 * 1. contrôle du droit de l'acteur (matrice de rôles) ;
 * 2. mutation ET ligne d'audit dans une seule transaction, donc impossible d'agir sans laisser de trace.
 */
abstract class AdminService
{
    public function __construct(protected Audit $audit) {}

    /**
     * @param  Closure(): Change  $mutate
     */
    protected function audited(StaffUser $actor, string $permission, string $action, string $subjectType, ?string $subjectId, Closure $mutate): mixed
    {
        Permissions::authorize($actor, $permission);

        return DB::transaction(function () use ($actor, $action, $subjectType, $subjectId, $mutate) {
            $change = $mutate();
            $this->audit->record($actor, $action, $subjectType, $change->subjectId ?? $subjectId, $change->before, $change->after);

            return $change->result;
        });
    }
}
