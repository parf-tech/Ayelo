<?php

namespace App\Filament\Support;

use App\Models\StaffUser;
use App\Services\Admin\Permissions;
use Closure;
use Filament\Facades\Filament;
use Filament\Notifications\Notification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\UniqueConstraintViolationException;

/** Aides d'interface : acteur courant et exécution d'une action d'administration avec retour utilisateur. */
final class Staff
{
    public static function current(): StaffUser
    {
        $user = Filament::auth()->user();
        abort_unless($user instanceof StaffUser, 403);

        return $user;
    }

    public static function can(string $ability): bool
    {
        $user = Filament::auth()->user();

        return $user instanceof StaffUser && Permissions::can($user, $ability);
    }

    /**
     * Exécute une action de service. Les refus métier (DomainException) et de droits s'affichent comme notification,
     * sans trace technique. Retourne vrai si l'action a abouti.
     */
    public static function run(Closure $action, string $success): bool
    {
        try {
            $action();
        } catch (\DomainException $e) {
            Notification::make()->danger()->title($e->getMessage())->send();

            return false;
        } catch (AuthorizationException) {
            Notification::make()->danger()->title('Action non autorisée pour votre rôle.')->send();

            return false;
        } catch (UniqueConstraintViolationException) {
            Notification::make()->danger()->title('Cette opération a déjà été enregistrée.')->send();

            return false;
        }

        Notification::make()->success()->title($success)->send();

        return true;
    }

    /** Échappe les jokers LIKE d'une saisie de recherche. */
    public static function like(string $search): string
    {
        return '%'.addcslashes($search, '%_\\').'%';
    }
}
