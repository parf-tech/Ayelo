<?php

namespace App\Filament\Resources\VerificationRequestResource\Pages;

use App\Filament\Models\VerificationRequest;
use App\Filament\Resources\VerificationRequestResource;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
use App\Services\Admin\VerificationReview;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Resources\Pages\ViewRecord;
use Livewire\Attributes\Locked;

class ViewVerificationRequest extends ViewRecord
{
    protected static string $resource = VerificationRequestResource::class;

    /** URL signée du selfie, uniquement après clic explicite (donc après écriture du journal). */
    #[Locked]
    public ?string $selfieUrl = null;

    protected function getHeaderActions(): array
    {
        $pending = fn (VerificationRequest $record): bool => $record->status === 'pending' && Staff::can(Permissions::VERIFICATIONS_REVIEW);

        return [
            Action::make('show_selfie')->label(Staff::t('admin.action.show_selfie'))->icon('heroicon-o-eye')->color('gray')
                ->visible(fn (VerificationRequest $record): bool => $record->status === 'pending' && Staff::can(Permissions::SELFIE_VIEW))
                ->action(function (VerificationRequest $record): void {
                    Staff::run(function () use ($record): void {
                        $this->selfieUrl = app(VerificationReview::class)->viewSelfie(Staff::current(), $record->id);
                    }, Staff::t('admin.notify.selfie_logged', ['minutes' => VerificationReview::SELFIE_TTL_MINUTES]));
                }),
            Action::make('approve')->label(Staff::t('admin.action.approve'))->icon('heroicon-o-check')->color('success')
                ->visible($pending)
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.verification.approve'))
                ->action(function (VerificationRequest $record): void {
                    if (Staff::run(fn () => app(VerificationReview::class)->approve(Staff::current(), $record->id), Staff::t('admin.notify.verified'))) {
                        $this->redirect(VerificationRequestResource::getUrl('index'));
                    }
                }),
            Action::make('reject')->label(Staff::t('admin.action.reject'))->icon('heroicon-o-x-mark')->color('danger')
                ->visible($pending)
                // Le rejet supprime définitivement le selfie du stockage : confirmation explicite avec la conséquence.
                ->requiresConfirmation()
                ->modalDescription(Staff::t('admin.confirm.verification.reject'))
                ->schema([Textarea::make('reason')->label(Staff::t('admin.field.reason_to_user'))->required()->minLength(3)->maxLength(300)])
                ->action(function (VerificationRequest $record, array $data): void {
                    if (Staff::run(fn () => app(VerificationReview::class)->reject(Staff::current(), $record->id, (string) $data['reason']), Staff::t('admin.notify.verification_rejected'))) {
                        $this->redirect(VerificationRequestResource::getUrl('index'));
                    }
                }),
        ];
    }
}
