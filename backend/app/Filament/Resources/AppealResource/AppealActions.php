<?php

namespace App\Filament\Resources\AppealResource;

use App\Filament\Models\Appeal;
use App\Filament\Support\Staff;
use App\Services\Admin\AppealReview;
use App\Services\Admin\Permissions;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;

final class AppealActions
{
    /** @return list<Action> */
    public static function make(?Closure $afterSuccess = null): array
    {
        $open = fn (Appeal $record): bool => $record->status === 'open' && Staff::can(Permissions::APPEALS_REVIEW);

        return [
            Action::make('accept')->label(Staff::t('admin.action.accept'))->icon('heroicon-o-check')->color('success')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.appeal.accept'))
                ->schema([Textarea::make('note')->label(Staff::t('admin.field.note_optional'))->maxLength(500)])
                ->action(function (Appeal $record, array $data) use ($afterSuccess): void {
                    $done = Staff::run(fn () => app(AppealReview::class)->accept(Staff::current(), $record->id, $data['note'] ?? null), Staff::t('admin.notify.appeal_accepted'));
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
            Action::make('reject')->label(Staff::t('admin.action.reject'))->icon('heroicon-o-x-mark')->color('danger')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.appeal.reject'))
                ->schema([Textarea::make('note')->label(Staff::t('admin.field.decision_note'))->required()->minLength(3)->maxLength(500)])
                ->action(function (Appeal $record, array $data) use ($afterSuccess): void {
                    $done = Staff::run(fn () => app(AppealReview::class)->reject(Staff::current(), $record->id, (string) $data['note']), Staff::t('admin.notify.appeal_rejected'));
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
        ];
    }
}
