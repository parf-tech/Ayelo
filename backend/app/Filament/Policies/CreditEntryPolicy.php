<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class CreditEntryPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::USERS_VIEW;
    }
}
