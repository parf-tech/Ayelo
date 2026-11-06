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
            Action::make('show_selfie')->label('Voir le selfie')->icon('heroicon-o-eye')->color('gray')
                ->visible(fn (VerificationRequest $record): bool => $record->status === 'pending' && Staff::can(Permissions::SELFIE_VIEW))
                ->action(function (VerificationRequest $record): void {
                    Staff::run(function () use ($record): void {
                        $this->selfieUrl = app(VerificationReview::class)->viewSelfie(Staff::current(), $record->id);
                    }, 'Consultation journalisée. Le lien expire dans '.VerificationReview::SELFIE_TTL_MINUTES.' minutes.');
                }),
            Action::make('approve')->label('Approuver')->icon('heroicon-o-check')->color('success')
                ->visible($pending)
                ->requiresConfirmation()
                ->modalDescription('Le badge « vérifié » est attribué et le selfie est supprimé.')
                ->action(function (VerificationRequest $record): void {
                    if (Staff::run(fn () => app(VerificationReview::class)->approve(Staff::current(), $record->id), 'Profil vérifié, selfie supprimé.')) {
                        $this->redirect(VerificationRequestResource::getUrl('index'));
                    }
                }),
            Action::make('reject')->label('Rejeter')->icon('heroicon-o-x-mark')->color('danger')
                ->visible($pending)
                ->schema([Textarea::make('reason')->label('Motif (communiqué à l\'utilisateur)')->required()->minLength(3)->maxLength(300)])
                ->action(function (VerificationRequest $record, array $data): void {
                    if (Staff::run(fn () => app(VerificationReview::class)->reject(Staff::current(), $record->id, (string) $data['reason']), 'Vérification rejetée, selfie supprimé.')) {
                        $this->redirect(VerificationRequestResource::getUrl('index'));
                    }
                }),
        ];
    }
}
