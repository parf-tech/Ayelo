<?php

namespace App\Filament\Policies;

use App\Models\StaffUser;
use App\Services\Admin\Permissions;

/**
 * Base des politiques : lecture selon le droit de la ressource ; création, modification, suppression refusées
 * (les écritures passent uniquement par les services d'administration, jamais par les formulaires génériques).
 */
abstract class AdminPolicy
{
    abstract protected function ability(): string;

    public function viewAny(StaffUser $staff): bool
    {
        return Permissions::can($staff, $this->ability());
    }

    public function view(StaffUser $staff, mixed $record = null): bool
    {
        return Permissions::can($staff, $this->ability());
    }

    public function create(StaffUser $staff): bool
    {
        return false;
    }

    public function update(StaffUser $staff, mixed $record = null): bool
    {
        return false;
    }

    public function delete(StaffUser $staff, mixed $record = null): bool
    {
        return false;
    }

    public function deleteAny(StaffUser $staff): bool
    {
        return false;
    }

    public function restore(StaffUser $staff, mixed $record = null): bool
    {
        return false;
    }

    public function forceDelete(StaffUser $staff, mixed $record = null): bool
    {
        return false;
    }
}
