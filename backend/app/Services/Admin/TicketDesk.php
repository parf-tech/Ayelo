<?php

namespace App\Services\Admin;

use App\Models\StaffUser;
use DomainException;
use Illuminate\Support\Facades\DB;

/** Tickets de support : statut et attribution (FR-I-11). */
class TicketDesk extends AdminService
{
    public const STATUSES = ['open', 'pending', 'closed'];

    public function update(StaffUser $actor, string $ticketId, string $status, ?string $assignedTo): void
    {
        if (! in_array($status, self::STATUSES, true)) {
            throw new DomainException('Statut inconnu.');
        }

        $this->audited($actor, Permissions::TICKETS_MANAGE, 'ticket.updated', 'support_tickets', $ticketId, function () use ($ticketId, $status, $assignedTo) {
            $ticket = DB::table('support_tickets')->where('id', $ticketId)->lockForUpdate()->first();
            if ($ticket === null) {
                throw new DomainException('Ticket introuvable.');
            }
            if ($assignedTo !== null) {
                $assignee = StaffUser::find($assignedTo);
                if ($assignee === null || ! Permissions::can($assignee, Permissions::TICKETS_MANAGE)) {
                    throw new DomainException('Ce membre du personnel ne peut pas traiter de tickets.');
                }
            }

            DB::table('support_tickets')->where('id', $ticketId)->update(['status' => $status, 'assigned_to' => $assignedTo, 'updated_at' => now()]);

            return new Change(null, ['status' => $ticket->status, 'assigned_to' => $ticket->assigned_to], ['status' => $status, 'assigned_to' => $assignedTo]);
        });
    }
}
