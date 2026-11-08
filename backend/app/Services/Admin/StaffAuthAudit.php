<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Events\Dispatcher;
use Illuminate\Support\Str;

/**
 * Journalise les connexions du personnel (réussies après 2FA, échouées, déconnexions) et met à jour last_login_at.
 * N'écoute que le garde « staff » : l'API mobile n'est pas concernée. Aucun identifiant secret n'est écrit.
 */
class StaffAuthAudit
{
    public function __construct(private Audit $audit) {}

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Login::class, [$this, 'onLogin']);
        $events->listen(Failed::class, [$this, 'onFailed']);
        $events->listen(Logout::class, [$this, 'onLogout']);
    }

    public function onLogin(Login $event): void
    {
        if ($event->guard !== 'staff' || ! $event->user instanceof StaffUser) {
            return;
        }
        $event->user->forceFill(['last_login_at' => now()])->save();
        $this->audit->record($event->user, 'staff.login', 'staff_users', $event->user->id, null, ['role' => $event->user->role]);
    }

    public function onFailed(Failed $event): void
    {
        if ($event->guard !== 'staff') {
            return;
        }
        $user = $event->user instanceof StaffUser ? $event->user : null;
        $this->audit->record($user, 'staff.login_failed', 'staff_users', $user?->id, null, ['email' => Str::limit(is_string($event->credentials['email'] ?? null) ? $event->credentials['email'] : '', 190, '')]);
    }

    public function onLogout(Logout $event): void
    {
        if ($event->guard !== 'staff' || ! $event->user instanceof StaffUser) {
            return;
        }
        $this->audit->record($event->user, 'staff.logout', 'staff_users', $event->user->id);
    }
}
