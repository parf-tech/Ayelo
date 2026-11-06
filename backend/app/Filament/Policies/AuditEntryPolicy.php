<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class AuditEntryPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::AUDIT_VIEW;
    }
}
