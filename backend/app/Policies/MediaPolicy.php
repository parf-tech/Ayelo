<?php

namespace App\Policies;

use App\Models\Media;
use App\Models\User;

class MediaPolicy
{
    /** Seul le propriétaire gère ses médias. */
    public function manage(User $user, Media $media): bool
    {
        return $media->user_id === $user->id;
    }
}
