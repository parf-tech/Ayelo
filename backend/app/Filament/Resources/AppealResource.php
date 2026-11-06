<?php

namespace App\Filament\Resources;

use App\Filament\Models\Appeal;
use App\Filament\Resources\AppealResource\AppealActions;
use App\Filament\Resources\AppealResource\Pages\ListAppeals;
use App\Filament\Resources\AppealResource\Pages\ViewAppeal;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Contestations de sanctions : les plus anciennes d'abord. */
class AppealResource extends AdminResource
{
    protected static ?string $model = Appeal::class;

    protected static ?string $slug = 'appeals';

    protected static ?string $modelLabel = 'contestation';

    protected static ?string $pluralModelLabel = 'contestations';

    protected static ?string $navigationLabel = 'Contestations';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-scale';

    protected static ?int $navigationSort = 30;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['sanction', 'member.profile'])->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) Appeal::query()->where('status', 'open')->count();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('member.profile.display_name')->label('Utilisateur')->placeholder('—'),
                TextColumn::make('sanction.kind')->label('Sanction')->badge(),
                TextColumn::make('message')->label('Message')->limit(80),
                TextColumn::make('status')->label('Statut')->badge(),
                TextColumn::make('created_at')->label('Reçue')->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label('Statut')->default('open')
                    ->options(['open' => 'Ouverte', 'accepted' => 'Acceptée', 'rejected' => 'Rejetée']),
            ])
            ->recordUrl(fn (Appeal $record): string => static::getUrl('view', ['record' => $record]))
            ->recordActions(AppealActions::make())
            ->emptyStateHeading('Aucune contestation');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Contestation')->columns(3)->schema([
                TextEntry::make('status')->label('Statut')->badge(),
                TextEntry::make('created_at')->label('Reçue')->dateTime(),
                TextEntry::make('decision_note')->label('Note de décision')->placeholder('—'),
                TextEntry::make('message')->label('Message de l\'utilisateur')->columnSpanFull(),
            ]),
            Section::make('Sanction contestée')->columns(3)->schema([
                TextEntry::make('sanction.kind')->label('Type')->badge(),
                TextEntry::make('sanction.reason')->label('Motif communiqué'),
                TextEntry::make('sanction.ends_at')->label('Fin')->dateTime()->placeholder('Sans fin'),
                TextEntry::make('member.status')->label('Statut du compte')->badge(),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListAppeals::route('/'),
            'view' => ViewAppeal::route('/{record}'),
        ];
    }
}
