<?php

namespace App\Filament\Resources;

use App\Filament\Models\MediaItem;
use App\Filament\Resources\MediaItemResource\Pages\ListMediaItems;
use App\Filament\Support\Staff;
use App\Services\Admin\MediaModeration;
use App\Services\Admin\Permissions;
use Filament\Notifications\Notification;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** File « Médias à modérer » (FR-H-4) : statut processing, les plus anciens d'abord. Aperçu par URL signée. */
class MediaItemResource extends AdminResource
{
    protected static ?string $model = MediaItem::class;

    protected static ?string $slug = 'media-queue';

    protected static ?string $modelLabel = 'média';

    protected static ?string $pluralModelLabel = 'médias à modérer';

    protected static ?string $navigationLabel = 'Médias à modérer';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-photo';

    protected static ?int $navigationSort = 10;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('status', 'processing')->where('kind', '<>', 'verification_selfie')->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) static::getEloquentQuery()->count();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('kind')->label('Type')->badge(),
                // Minimisation (revue N-09) : l'e-mail n'est montré qu'au rôle qui peut déjà consulter les comptes.
                TextColumn::make('owner.email')->label('Utilisateur')->visible(fn () => Staff::can(Permissions::USERS_VIEW)),
                TextColumn::make('mime_type')->label('Format'),
                TextColumn::make('size_bytes')->label('Poids')->formatStateUsing(fn ($state) => $state ? number_format($state / 1024, 0, ',', ' ').' Ko' : '—'),
                TextColumn::make('created_at')->label('Déposé')->since(),
            ])
            ->recordActions([
                Action::make('preview')->label('Aperçu')->icon('heroicon-o-eye')->color('gray')
                    ->visible(fn () => Staff::can(Permissions::MEDIA_MODERATE))
                    // L'URL signée courte n'est produite qu'au clic, et l'ouverture est journalisée (« media.preview », revue N-09).
                    // Le lien est remis dans une notification : l'écriture du journal précède donc toujours l'accès au fichier.
                    // (Le journal enregistre la génération de l'URL, pas le chargement effectif de l'image par le navigateur.)
                    ->action(function (MediaItem $record): void {
                        $url = null;
                        if (Staff::run(function () use ($record, &$url): void {
                            $url = app(MediaModeration::class)->preview(Staff::current(), $record->id);
                        }, 'Aperçu journalisé.') && $url !== null) {
                            Notification::make()->success()->title('Lien d’aperçu prêt (expire dans '.(int) config('media.read_ttl_minutes', 10).' minutes)')->persistent()
                                ->actions([Action::make('open')->label('Ouvrir l’image')->url($url, shouldOpenInNewTab: true)->button()])
                                ->send();
                        }
                    }),
                Action::make('approve')->label('Approuver')->icon('heroicon-o-check')->color('success')
                    ->visible(fn () => Staff::can(Permissions::MEDIA_MODERATE))
                    ->requiresConfirmation()
                    ->action(fn (MediaItem $record) => Staff::run(
                        fn () => app(MediaModeration::class)->approve(Staff::current(), $record->id), 'Média approuvé.')),
                Action::make('reject')->label('Rejeter')->icon('heroicon-o-x-mark')->color('danger')
                    ->visible(fn () => Staff::can(Permissions::MEDIA_MODERATE))
                    ->modalDescription('Le fichier sera supprimé du stockage.')
                    ->schema([
                        Select::make('label')->label('Motif')->required()->options([
                            'nudity' => 'Nudité / contenu explicite', 'violence' => 'Violence', 'minor' => 'Mineur apparent',
                            'spam' => 'Spam / publicité', 'illegal' => 'Contenu illégal', 'other' => 'Autre',
                        ]),
                    ])
                    ->action(fn (MediaItem $record, array $data) => Staff::run(
                        fn () => app(MediaModeration::class)->reject(Staff::current(), $record->id, $data['label']), 'Média rejeté et supprimé.')),
            ])
            ->emptyStateHeading('Aucun média en attente');
    }

    public static function getPages(): array
    {
        return ['index' => ListMediaItems::route('/')];
    }
}
