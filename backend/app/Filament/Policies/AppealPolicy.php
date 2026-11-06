<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class AppealPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::APPEALS_REVIEW;
    }
}
