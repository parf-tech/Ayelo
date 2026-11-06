<?php

namespace App\Filament\Resources\MemberResource\Pages;

use App\Filament\Models\Member;
use App\Filament\Resources\MemberResource;
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
        $reason = fn () => Textarea::make('reason')->label('Motif (obligatoire)')->required()->minLength(5)->maxLength(500);
        $manage = fn (): bool => Staff::can(Permissions::USERS_MANAGE);
        $done = function (bool $ok): void {
            if ($ok) {
                // Relecture par la requête de la ressource (colonnes restreintes : pas de hash de mot de passe).
                $this->record = $this->resolveRecord($this->record->getKey());
            }
        };

        return [
            Action::make('suspend')->label('Suspendre')->icon('heroicon-o-pause-circle')->color('warning')
                ->visible(fn (Member $record): bool => $manage() && $record->status === 'active')
                ->schema([
                    Select::make('days')->label('Durée')->required()->options([1 => '1 jour', 3 => '3 jours', 7 => '7 jours', 30 => '30 jours', 90 => '90 jours']),
                    $reason(),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->suspend(Staff::current(), $record->id, $data['reason'], (int) $data['days']), 'Compte suspendu.'))),
            Action::make('ban')->label('Bannir')->icon('heroicon-o-no-symbol')->color('danger')
                ->visible(fn (Member $record): bool => $manage() && in_array($record->status, ['active', 'suspended'], true))
                ->requiresConfirmation()
                ->schema([$reason()])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->ban(Staff::current(), $record->id, $data['reason']), 'Compte banni.'))),
            Action::make('reactivate')->label('Réactiver')->icon('heroicon-o-arrow-uturn-left')->color('success')
                ->visible(fn (Member $record): bool => $manage() && in_array($record->status, ['suspended', 'banned'], true))
                ->requiresConfirmation()
                ->schema([$reason()])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->reactivate(Staff::current(), $record->id, $data['reason']), 'Compte réactivé.'))),
            Action::make('adjust_credits')->label('Ajuster les crédits')->icon('heroicon-o-banknotes')->color('gray')
                ->visible(fn (): bool => Staff::can(Permissions::CREDITS_ADJUST))
                ->schema([
                    // Clé d'idempotence générée à l'ouverture du formulaire : une double soumission n'ajuste qu'une fois.
                    Hidden::make('key')->default(fn (): string => (string) Str::uuid()),
                    Select::make('credit_type')->label('Type')->required()->options(['conversation' => 'Conversation', 'proposal' => 'Proposition', 'coin' => 'Pièces']),
                    TextInput::make('delta')->label('Variation (+ ou −)')->numeric()->integer()->required()->minValue(-UserAdmin::MAX_CREDIT_DELTA)->maxValue(UserAdmin::MAX_CREDIT_DELTA),
                    Textarea::make('note')->label('Motif (obligatoire)')->required()->minLength(5)->maxLength(500),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->adjustCredits(Staff::current(), $record->id, $data['credit_type'], (int) $data['delta'], $data['note'], $data['key']),
                    'Crédits ajustés.'))),
            Action::make('grant_premium')->label('Offrir le Premium')->icon('heroicon-o-gift')->color('gray')
                ->visible(fn (): bool => Staff::can(Permissions::PREMIUM_GRANT))
                ->schema([
                    Select::make('days')->label('Durée')->required()->options([7 => '7 jours', 30 => '30 jours', 90 => '90 jours', 180 => '180 jours', 365 => '1 an']),
                    Textarea::make('note')->label('Motif (obligatoire)')->required()->minLength(5)->maxLength(500),
                ])
                ->action(fn (Member $record, array $data) => $done(Staff::run(
                    fn () => app(UserAdmin::class)->grantPremium(Staff::current(), $record->id, now()->addDays((int) $data['days']), $data['note']),
                    'Premium offert.'))),
        ];
    }
}
