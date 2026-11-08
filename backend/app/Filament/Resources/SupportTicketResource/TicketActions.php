<?php

namespace App\Filament\Resources\SupportTicketResource;

use App\Filament\Models\SupportTicket;
use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
use App\Models\StaffUser;
use App\Services\Admin\Permissions;
use App\Services\Admin\TicketDesk;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;

final class TicketActions
{
    /** @return list<Action> */
    public static function make(?Closure $afterSuccess = null): array
    {
        $allowed = fn (): bool => Staff::can(Permissions::TICKETS_MANAGE);

        return [
            Action::make('update')->label(Staff::t('admin.action.ticket_update'))->icon('heroicon-o-pencil-square')->color('gray')
                ->visible($allowed)
                ->fillForm(fn (SupportTicket $record): array => ['status' => $record->status, 'assigned_to' => $record->assigned_to])
                ->schema([
                    Select::make('status')->label(Staff::t('admin.col.status'))->required()->options(Labels::options('ticket', ['open', 'pending', 'closed'])),
                    Select::make('assigned_to')->label(Staff::t('admin.field.assign_to'))->placeholder(Staff::t('admin.misc.unassigned'))
                        ->options(fn (): array => StaffUser::query()->where('is_active', true)->whereIn('role', ['support', 'admin'])->orderBy('email')->pluck('email', 'id')->all()),
                ])
                ->action(function (SupportTicket $record, array $data) use ($afterSuccess): void {
                    $done = Staff::run(
                        fn () => app(TicketDesk::class)->update(Staff::current(), $record->id, $data['status'], $data['assigned_to'] ?: null),
                        Staff::t('admin.notify.ticket_updated'),
                    );
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
            Action::make('assign_me')->label(Staff::t('admin.action.assign_me'))->icon('heroicon-o-user-plus')->color('primary')
                ->visible(fn (SupportTicket $record): bool => $allowed() && $record->assigned_to !== Staff::current()->id)
                ->action(function (SupportTicket $record) use ($afterSuccess): void {
                    $done = Staff::run(
                        fn () => app(TicketDesk::class)->update(Staff::current(), $record->id, $record->status, Staff::current()->id),
                        Staff::t('admin.notify.ticket_assigned'),
                    );
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
        ];
    }
}
