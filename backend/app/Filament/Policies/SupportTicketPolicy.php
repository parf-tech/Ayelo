<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class SupportTicketPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::TICKETS_MANAGE;
    }
}
