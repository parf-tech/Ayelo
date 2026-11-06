<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class SanctionPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::USERS_VIEW;
    }
}
