<?php

namespace App\Filament\Policies;

use App\Services\Admin\Permissions;

class MediaItemPolicy extends AdminPolicy
{
    protected function ability(): string
    {
        return Permissions::MEDIA_MODERATE;
    }
}
