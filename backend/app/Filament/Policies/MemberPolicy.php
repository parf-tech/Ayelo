<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class MemberPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::USERS_VIEW;
    }
}
