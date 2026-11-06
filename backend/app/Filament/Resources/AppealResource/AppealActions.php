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
            Action::make('accept')->label('Accepter')->icon('heroicon-o-check')->color('success')
                ->visible($open)
                ->requiresConfirmation()
                ->modalDescription('La sanction est levée et le compte réactivé s\'il n\'a pas d\'autre restriction.')
                ->schema([Textarea::make('note')->label('Note (facultative)')->maxLength(500)])
                ->action(function (Appeal $record, array $data) use ($afterSuccess): void {
                    $done = Staff::run(fn () => app(AppealReview::class)->accept(Staff::current(), $record->id, $data['note'] ?? null), 'Contestation acceptée, sanction levée.');
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
            Action::make('reject')->label('Rejeter')->icon('heroicon-o-x-mark')->color('danger')
                ->visible($open)
                ->schema([Textarea::make('note')->label('Note de décision (obligatoire)')->required()->minLength(3)->maxLength(500)])
                ->action(function (Appeal $record, array $data) use ($afterSuccess): void {
                    $done = Staff::run(fn () => app(AppealReview::class)->reject(Staff::current(), $record->id, (string) $data['note']), 'Contestation rejetée.');
                    if ($done && $afterSuccess) {
                        $afterSuccess($record);
                    }
                }),
        ];
    }
}
