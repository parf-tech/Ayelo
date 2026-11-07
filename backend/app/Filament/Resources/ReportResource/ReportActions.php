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
use Filament\Schemas\Components\Text;
use Filament\Schemas\Components\Utilities\Get;

/**
 * Décisions sur un signalement, partagées entre la liste et la fiche. Chaque action appelle ReportModeration (droits + audit).
 * Toute décision qui touche le compte signalé demande une confirmation qui nomme le compte et énonce la conséquence.
 */
final class ReportActions
{
    public const SUSPENSION_DAYS = [1, 3, 7, 30, 90];

    /** Nom du compte signalé, pour les textes de confirmation. */
    private static function name(Report $record): string
    {
        return (string) ($record->reported?->profile?->display_name ?: Staff::t('admin.misc.this_account'));
    }

    /**
     * @param  Closure(Report): void|null  $afterSuccess
     * @return list<Action>
     */
    public static function make(?Closure $afterSuccess = null): array
    {
        $note = fn (string $label) => Textarea::make('note')->label(Staff::t($label))->required()->minLength(3)->maxLength(500);
        $open = fn (Report $record): bool => in_array($record->status, ['open', 'reviewed'], true) && Staff::can(Permissions::REPORTS_REVIEW);
        $decide = fn (string $decision, string $successKey) => function (Report $record, array $data) use ($decision, $successKey, $afterSuccess): void {
            $done = Staff::run(
                fn () => app(ReportModeration::class)->decide(Staff::current(), $record->id, $decision, (string) $data['note'], isset($data['days']) ? (int) $data['days'] : null),
                Staff::t($successKey),
            );
            if ($done && $afterSuccess) {
                $afterSuccess($record);
            }
        };
        $confirm = fn (string $key) => fn (Report $record): string => Staff::t($key, ['name' => self::name($record)]);

        return [
            Action::make('warn')->label(Staff::t('admin.action.warn'))->icon('heroicon-o-exclamation-triangle')->color('warning')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.warn'))
                ->schema([$note('admin.field.message_to_user')])
                ->action($decide('warning', 'admin.notify.warned')),
            Action::make('suspend')->label(Staff::t('admin.action.suspend'))->icon('heroicon-o-pause-circle')->color('danger')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.suspend'))
                ->schema(fn (Report $record): array => [
                    Select::make('days')->label(Staff::t('admin.field.duration'))->required()->live()
                        ->options(collect(self::SUSPENSION_DAYS)->mapWithKeys(fn (int $d): array => [$d => Staff::days($d)])->all()),
                    // Rappel de la conséquence avec la durée choisie (revue design : nom du compte et durée avant de confirmer).
                    Text::make(fn (Get $get): string => filled($get('days'))
                        ? Staff::t('admin.confirm.report.suspend_duration', ['name' => self::name($record), 'days' => (int) $get('days')])
                        : ''),
                    $note('admin.field.reason_to_user'),
                ])
                ->action($decide('suspension', 'admin.notify.suspended')),
            Action::make('ban')->label(Staff::t('admin.action.ban'))->icon('heroicon-o-no-symbol')->color('danger')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.ban'))
                ->schema([$note('admin.field.reason_to_user')])
                ->action($decide('ban', 'admin.notify.banned')),
            Action::make('dismiss')->label(Staff::t('admin.action.dismiss'))->icon('heroicon-o-archive-box')->color('gray')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.dismiss'))
                ->schema([$note('admin.field.internal_note')])
                ->action($decide('dismiss', 'admin.notify.dismissed')),
            Action::make('lift_preventive')->label(Staff::t('admin.action.lift_preventive'))->icon('heroicon-o-arrow-uturn-left')->color('success')
                ->visible(fn (Report $record): bool => $record->reason === 'minor_suspected' && $open($record))
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.report.lift_preventive'))
                ->schema([$note('admin.field.justification')])
                ->action($decide('lift_preventive', 'admin.notify.preventive_lifted')),
        ];
    }
}
