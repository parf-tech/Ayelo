<?php

namespace App\Filament\Resources\MemberResource\Pages;

use App\Filament\Models\Member;
use App\Filament\Resources\MemberResource;
use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
use App\Services\Admin\UserAdmin;
use Filament\Actions\Action;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Support\Str;

/** Fiche utilisateur. Les actions sont réservées à l'admin (droit users.manage / credits.adjust / premium.grant). */
class ViewMember extends ViewRecord
{
    protected static string $resource = MemberResource::class;

    protected function getHeaderActions(): array
    {
        $reason = fn () => Textarea::make('reason')->label(Staff::t('admin.field.reason_required'))->required()->minLength(5)->maxLength(500);
        $name = fn (Member $record): string => (string) ($record->profile?->display_name ?: Staff::t('admin.misc.this_account'));
        $days = fn (array $values) => collect($values)->mapWithKeys(fn (int $d): array => [$d => Staff::days($d)])->all();
        $manage = fn (): bool => Staff::can(Permissions::USERS_MANAGE);
        $done = function (bool $ok): void {
            if ($ok) {
                // Relecture par la requête de la ressource (colonnes restreintes : pas de hash de mot de passe).
                $this->record = $this->resolveRecord($this->record->getKey());
            }
        };

        return [
            Action::make('suspend')->label(Staff::t('admin.action.suspend'))->icon('heroicon-o-pause-circle')->color('warning')
                ->visible(fn (Member $record): bool => $manage() && $record->status === 'active')
                ->requiresConfirmation()
                ->modalDescription(fn (Member $record): string => Staff::t('admin.confirm.member.suspend', ['name' => $name($record)]))
                ->schema([
                    Select::make('days')->label(Staff::t('admin.field.duration'))->required()->options($days([1, 3, 7, 30, 90])),
                    $reason(),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->suspend(Staff::current(), $record->id, $data['reason'], (int) $data['days']), Staff::t('admin.notify.suspended')))),
            Action::make('ban')->label(Staff::t('admin.action.ban'))->icon('heroicon-o-no-symbol')->color('danger')
                ->visible(fn (Member $record): bool => $manage() && in_array($record->status, ['active', 'suspended'], true))
                ->requiresConfirmation()
                ->modalDescription(fn (Member $record): string => Staff::t('admin.confirm.member.ban', ['name' => $name($record)]))
                ->schema([$reason()])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->ban(Staff::current(), $record->id, $data['reason']), Staff::t('admin.notify.banned')))),
            Action::make('reactivate')->label(Staff::t('admin.action.reactivate'))->icon('heroicon-o-arrow-uturn-left')->color('success')
                ->visible(fn (Member $record): bool => $manage() && in_array($record->status, ['suspended', 'banned'], true))
                ->requiresConfirmation()
                ->modalDescription(fn (Member $record): string => Staff::t('admin.confirm.member.reactivate', ['name' => $name($record)]))
                ->schema([$reason()])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->reactivate(Staff::current(), $record->id, $data['reason']), Staff::t('admin.notify.reactivated')))),
            Action::make('adjust_credits')->label(Staff::t('admin.action.adjust_credits'))->icon('heroicon-o-banknotes')->color('gray')
                ->visible(fn (): bool => Staff::can(Permissions::CREDITS_ADJUST))
                ->schema([
                    // Clé d'idempotence générée à l'ouverture du formulaire : une double soumission n'ajuste qu'une fois.
                    Hidden::make('key')->default(fn (): string => (string) Str::uuid()),
                    Select::make('credit_type')->label(Staff::t('admin.col.type'))->required()->options(Labels::options('credit_type', ['conversation', 'proposal', 'coin'])),
                    TextInput::make('delta')->label(Staff::t('admin.field.delta'))->numeric()->integer()->required()->minValue(-UserAdmin::MAX_CREDIT_DELTA)->maxValue(UserAdmin::MAX_CREDIT_DELTA),
                    Textarea::make('note')->label(Staff::t('admin.field.reason_required'))->required()->minLength(5)->maxLength(500),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->adjustCredits(Staff::current(), $record->id, $data['credit_type'], (int) $data['delta'], $data['note'], $data['key']),
                    Staff::t('admin.notify.credits_adjusted')))),
            Action::make('grant_premium')->label(Staff::t('admin.action.grant_premium'))->icon('heroicon-o-gift')->color('gray')
                ->visible(fn (): bool => Staff::can(Permissions::PREMIUM_GRANT))
                ->schema([
                    Select::make('days')->label(Staff::t('admin.field.duration'))->required()->options($days([7, 30, 90, 180, 365])),
                    Textarea::make('note')->label(Staff::t('admin.field.reason_required'))->required()->minLength(5)->maxLength(500),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->grantPremium(Staff::current(), $record->id, now()->addDays((int) $data['days']), $data['note']),
                    Staff::t('admin.notify.premium_granted')))),
        ];
    }
}
