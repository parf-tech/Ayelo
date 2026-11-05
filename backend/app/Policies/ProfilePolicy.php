<?php

namespace App\Policies;

use App\Models\Profile;
use App\Models\User;
use App\Support\Blocks;

class ProfilePolicy
{
    /**
     * Un profil est visible par un autre utilisateur seulement s'il est actif, affiché (is_visible),
     * non bloqué dans l'un ou l'autre sens, et si le demandeur a lui-même un profil.
     */
    public function view(User $viewer, Profile $profile): bool
    {
        if ($viewer->id === $profile->user_id) {
            return true;
        }

        if (! $profile->is_visible || $profile->user->status !== 'active') {
            return false;
        }

        if (! Profile::where('user_id', $viewer->id)->exists()) {
            return false;
        }

        return ! Blocks::between($viewer->id, $profile->user_id);
    }
}
