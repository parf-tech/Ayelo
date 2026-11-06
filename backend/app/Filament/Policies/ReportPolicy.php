<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class ReportPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::REPORTS_REVIEW;
    }
}
