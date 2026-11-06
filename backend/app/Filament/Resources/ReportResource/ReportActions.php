<?php

namespace App\Filament\Resources\ReportResource;

use App\Filament\Models\Report;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
use App\Services\Admin\ReportModeration;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;

/** Décisions sur un signalement, partagées entre la liste et la fiche. Chaque action appelle ReportModeration (droits + audit). */
final class ReportActions
{
    /**
     * @param  Closure(Report): void|null  $afterSuccess
     * @return list<Action>
     */
    public static function make(?Closure $afterSuccess = null): array
    {
        $note = fn (string $label) => Textarea::make('note')->label($label)->required()->minLength(3)->maxLength(500);
        $open = fn (Report $record): bool => in_array($record->status, ['open', 'reviewed'], true) && Staff::can(Permissions::REPORTS_REVIEW);
        $decide = fn (string $decision, string $success) => function (Report $record, array $data) use ($decision, $success, $afterSuccess): void {
            $done = Staff::run(
                fn () => app(ReportModeration::class)->decide(Staff::current(), $record->id, $decision, (string) $data['note'], isset($data['days']) ? (int) $data['days'] : null),
                $success,
            );
            if ($done && $afterSuccess) {
                $afterSuccess($record);
            }
        };

        return [
            Action::make('warn')->label('Avertir')->icon('heroicon-o-exclamation-triangle')->color('warning')
                ->visible($open)
                ->schema([$note('Message communiqué à l\'utilisateur')])
                ->action($decide('warning', 'Avertissement enregistré.')),
            Action::make('suspend')->label('Suspendre')->icon('heroicon-o-pause-circle')->color('danger')
                ->visible($open)
                ->schema([
                    Select::make('days')->label('Durée')->required()->options([1 => '1 jour', 3 => '3 jours', 7 => '7 jours', 30 => '30 jours', 90 => '90 jours']),
                    $note('Motif communiqué à l\'utilisateur'),
                ])
                ->action($decide('suspension', 'Compte suspendu.')),
            Action::make('ban')->label('Bannir')->icon('heroicon-o-no-symbol')->color('danger')
                ->visible($open)
                ->requiresConfirmation()
                ->schema([$note('Motif communiqué à l\'utilisateur')])
                ->action($decide('ban', 'Compte banni.')),
            Action::make('dismiss')->label('Classer sans suite')->icon('heroicon-o-archive-box')->color('gray')
                ->visible($open)
                ->schema([$note('Note interne')])
                ->action($decide('dismiss', 'Signalement classé.')),
            Action::make('lift_preventive')->label('Lever la suspension préventive')->icon('heroicon-o-arrow-uturn-left')->color('success')
                ->visible(fn (Report $record): bool => $record->reason === 'minor_suspected' && $open($record))
                ->requiresConfirmation()
                ->modalDescription('Le compte est réactivé et le signalement classé : à faire seulement si la personne est majeure.')
                ->schema([$note('Justification')])
                ->action($decide('lift_preventive', 'Suspension préventive levée.')),
        ];
    }
}
