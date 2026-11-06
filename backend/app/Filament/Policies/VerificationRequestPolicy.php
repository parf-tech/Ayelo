<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class VerificationRequestPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::VERIFICATIONS_REVIEW;
    }
}
