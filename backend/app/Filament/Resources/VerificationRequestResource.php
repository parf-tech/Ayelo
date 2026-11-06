<?php

namespace App\Filament\Resources;

use App\Filament\Models\VerificationRequest;
use App\Filament\Resources\VerificationRequestResource\Pages\ListVerificationRequests;
use App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\HtmlString;

/**
 * Vérifications de profil (FR-B-6). Le selfie n'apparaît JAMAIS dans la liste : il faut ouvrir la fiche
 * et cliquer « Voir le selfie » (URL signée de 2 minutes, consultation journalisée).
 */
class VerificationRequestResource extends AdminResource
{
    protected static ?string $model = VerificationRequest::class;

    protected static ?string $slug = 'verifications';

    protected static ?string $modelLabel = 'vérification';

    protected static ?string $pluralModelLabel = 'vérifications de profil';

    protected static ?string $navigationLabel = 'Vérifications';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-identification';

    protected static ?int $navigationSort = 40;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('member.profile')->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) VerificationRequest::query()->where('status', 'pending')->count();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('member.profile.display_name')->label('Utilisateur')->placeholder('—'),
                TextColumn::make('pose_code')->label('Pose demandée'),
                TextColumn::make('status')->label('Statut')->badge(),
                TextColumn::make('created_at')->label('Reçue')->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label('Statut')->default('pending')
                    ->options(['pending' => 'En attente', 'approved' => 'Approuvée', 'rejected' => 'Rejetée']),
            ])
            ->recordUrl(fn (VerificationRequest $record): string => static::getUrl('view', ['record' => $record]))
            ->emptyStateHeading('Aucune vérification');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Demande')->columns(3)->schema([
                TextEntry::make('member.profile.display_name')->label('Utilisateur')->placeholder('—'),
                TextEntry::make('pose_code')->label('Pose demandée'),
                TextEntry::make('status')->label('Statut')->badge(),
                TextEntry::make('reject_reason')->label('Motif de rejet')->placeholder('—'),
                TextEntry::make('created_at')->label('Reçue')->dateTime(),
            ]),
            Section::make('Selfie')->schema([
                TextEntry::make('selfie')->hiddenLabel()->html()
                    ->state(fn ($livewire): ?HtmlString => $livewire->selfieUrl
                        ? new HtmlString('<img src="'.e($livewire->selfieUrl).'" alt="Selfie de vérification" style="max-width:24rem;border-radius:.5rem">')
                        : null)
                    ->placeholder('Cliquez sur « Voir le selfie » (la consultation est journalisée).'),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListVerificationRequests::route('/'),
            'view' => ViewVerificationRequest::route('/{record}'),
        ];
    }
}
