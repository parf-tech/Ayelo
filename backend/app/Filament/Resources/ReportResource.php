<?php

namespace App\Filament\Resources;

use App\Filament\Models\Report;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Filament\Resources\ReportResource\Pages\ViewReport;
use App\Filament\Resources\ReportResource\ReportActions;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** File « Signalements » (FR-H-5) : priorité décroissante, puis les plus anciens d'abord (délais 24 h / 2 h, docs/11). */
class ReportResource extends AdminResource
{
    protected static ?string $model = Report::class;

    protected static ?string $slug = 'reports';

    protected static ?string $modelLabel = 'signalement';

    protected static ?string $pluralModelLabel = 'signalements';

    protected static ?string $navigationLabel = 'Signalements';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-flag';

    protected static ?int $navigationSort = 20;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['reported.profile', 'reporter'])->orderByDesc('priority')->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) Report::query()->where('status', 'open')->count();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('priority')->label('Priorité')->badge()
                    ->formatStateUsing(fn ($state) => __('admin.priority.'.$state))
                    ->color(fn ($state) => match ((int) $state) {2 => 'danger', 1 => 'warning', default => 'gray'}),
                TextColumn::make('reason')->label('Motif')->formatStateUsing(fn ($state) => __('admin.reasons.'.$state)),
                TextColumn::make('reported.profile.display_name')->label('Signalé')->placeholder('—'),
                TextColumn::make('reported.status')->label('Compte')->badge(),
                TextColumn::make('status')->label('Statut')->badge(),
                TextColumn::make('created_at')->label('Reçu')->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label('Statut')->default('open')
                    ->options(['open' => 'Ouvert', 'reviewed' => 'Revu', 'actioned' => 'Sanctionné', 'dismissed' => 'Classé']),
                SelectFilter::make('priority')->label('Priorité')->options([0 => 'Normale', 1 => 'Élevée', 2 => 'Critique']),
            ])
            ->recordUrl(fn (Report $record): string => static::getUrl('view', ['record' => $record]))
            ->recordActions(ReportActions::make())
            ->emptyStateHeading('Aucun signalement');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Signalement')->columns(3)->schema([
                TextEntry::make('reason')->label('Motif')->formatStateUsing(fn ($state) => __('admin.reasons.'.$state)),
                TextEntry::make('priority')->label('Priorité')->formatStateUsing(fn ($state) => __('admin.priority.'.$state)),
                TextEntry::make('status')->label('Statut')->badge(),
                TextEntry::make('details')->label('Détails du signalant')->columnSpanFull()->placeholder('—'),
                TextEntry::make('context_type')->label('Contexte')->placeholder('—'),
                TextEntry::make('created_at')->label('Reçu')->dateTime(),
                TextEntry::make('outcome')->label('Décision')->placeholder('—'),
            ]),
            Section::make('Compte signalé')->columns(3)->schema([
                TextEntry::make('reported.profile.display_name')->label('Nom')->placeholder('—'),
                TextEntry::make('reported.status')->label('Statut du compte')->badge(),
                TextEntry::make('reported.risk_score')->label('Score de risque'),
                TextEntry::make('sanctions_count')->label('Sanctions antérieures')
                    ->state(fn (Report $record): int => $record->reported->sanctions()->count()),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListReports::route('/'),
            'view' => ViewReport::route('/{record}'),
        ];
    }
}
