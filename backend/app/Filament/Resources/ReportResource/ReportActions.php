<?php

namespace App\Filament\Resources\ReportResource;

use App\Filament\Models\Report;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
use App\Services\Admin\ReportAssignment;
use App\Services\Admin\ReportModeration;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\Checkbox;
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

    /** Autres signalements ouverts du même motif sur le même compte, que la décision peut clore avec celui-ci (aucun pour « mineur suspecté »). */
    private static function duplicates(Report $record): int
    {
        if ($record->reason === 'minor_suspected') {
            return 0;
        }
        $me = Staff::current()->id;

        return Report::query()->where('reported_id', $record->reported_id)->where('reason', $record->reason)->whereIn('status', ['open', 'reviewed'])
            ->where('id', '<>', $record->id)
            ->where(fn ($q) => $q->whereNull('assigned_to')->orWhere('assigned_to', $me)->orWhere('assigned_at', '<', now()->subMinutes(ReportAssignment::ttlMinutes())))
            ->count();
    }

    /**
     * @param  Closure(Report): void|null  $afterSuccess
     * @return list<Action>
     */
    public static function make(?Closure $afterSuccess = null): array
    {
        $note = fn (string $label) => Textarea::make('note')->label(Staff::t($label))->required()->minLength(3)->maxLength(500);
        // Séparée du motif communiqué (pentest P-09) : lue par le personnel seulement.
        $internal = fn () => Textarea::make('internal_note')->label(Staff::t('admin.field.sanction_internal_note'))
            ->helperText(Staff::t('admin.field.sanction_internal_note_hint'))->maxLength(1000);
        $canReview = fn (Report $record): bool => in_array($record->status, ['open', 'reviewed'], true) && Staff::can(Permissions::REPORTS_REVIEW);
        $lockedByOther = fn (Report $record): bool => ReportAssignment::lockedByOther($record, Staff::current()->id);
        // Un signalement pris par une autre personne ne se décide pas (le service le refuse aussi) : les décisions sont masquées.
        $open = fn (Report $record): bool => $canReview($record) && ! $lockedByOther($record);
        $isAdmin = fn (): bool => Staff::can(Permissions::USERS_MANAGE);
        // Décochée par défaut : grouper est un choix explicite, jamais un effet de bord d'une décision isolée.
        $duplicates = fn (Report $record): Checkbox => Checkbox::make('with_duplicates')
            ->label(Staff::t('admin.field.with_duplicates', ['count' => self::duplicates($record)]))->default(false)->visible(self::duplicates($record) > 0);
        $decide = fn (string $decision, string $successKey) => function (Report $record, array $data) use ($decision, $successKey, $afterSuccess): void {
            $done = Staff::run(
                fn () => app(ReportModeration::class)->decide(
                    Staff::current(), $record->id, $decision, (string) $data['note'], isset($data['days']) ? (int) $data['days'] : null,
                    withDuplicates: (bool) ($data['with_duplicates'] ?? false), internalNote: $data['internal_note'] ?? null,
                ),
                Staff::t($successKey),
            );
            if ($done && $afterSuccess) {
                $afterSuccess($record);
            }
        };
        $assign = fn (string $method, string $successKey, bool $force = false) => function (Report $record) use ($method, $successKey, $force, $afterSuccess): void {
            $done = Staff::run(
                fn () => $force ? app(ReportAssignment::class)->claim(Staff::current(), $record->id, force: true) : app(ReportAssignment::class)->{$method}(Staff::current(), $record->id),
                Staff::t($successKey),
            );
            if ($done && $afterSuccess) {
                $afterSuccess($record);
            }
        };
        $confirm = fn (string $key) => fn (Report $record): string => Staff::t($key, ['name' => self::name($record)]);

        return [
            Action::make('claim')->label(Staff::t('admin.action.claim'))->icon('heroicon-o-hand-raised')->color('primary')
                ->visible(fn (Report $record): bool => $canReview($record) && $record->assigned_to !== Staff::current()->id && ! $lockedByOther($record))
                ->action($assign('claim', 'admin.notify.claimed')),
            Action::make('release')->label(Staff::t('admin.action.release'))->icon('heroicon-o-hand-thumb-down')->color('gray')
                ->visible(fn (Report $record): bool => $canReview($record) && $record->assigned_to !== null
                    && ($record->assigned_to === Staff::current()->id || $isAdmin()))
                ->action($assign('release', 'admin.notify.released')),
            Action::make('take_over')->label(Staff::t('admin.action.take_over'))->icon('heroicon-o-arrow-path')->color('warning')
                ->visible(fn (Report $record): bool => $canReview($record) && $lockedByOther($record) && $isAdmin())
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.report.take_over'))
                ->action($assign('claim', 'admin.notify.claimed', force: true)),
            Action::make('warn')->label(Staff::t('admin.action.warn'))->icon('heroicon-o-exclamation-triangle')->color('warning')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.warn'))
                ->schema(fn (Report $record): array => [$note('admin.field.message_to_user'), $internal(), $duplicates($record)])
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
                    $internal(),
                    $duplicates($record),
                ])
                ->action($decide('suspension', 'admin.notify.suspended')),
            Action::make('ban')->label(Staff::t('admin.action.ban'))->icon('heroicon-o-no-symbol')->color('danger')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.ban'))
                ->schema(fn (Report $record): array => [$note('admin.field.reason_to_user'), $internal(), $duplicates($record)])
                ->action($decide('ban', 'admin.notify.banned')),
            Action::make('dismiss')->label(Staff::t('admin.action.dismiss'))->icon('heroicon-o-archive-box')->color('gray')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription($confirm('admin.confirm.report.dismiss'))
                ->schema(fn (Report $record): array => [$note('admin.field.internal_note'), $duplicates($record)])
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
