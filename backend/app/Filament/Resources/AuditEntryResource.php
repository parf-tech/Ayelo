<?php

namespace App\Filament\Resources;

use App\Filament\Models\AuditEntry;
use App\Filament\Resources\AuditEntryResource\Pages\ListAuditEntries;
use App\Filament\Resources\AuditEntryResource\Pages\ViewAuditEntry;
use App\Services\Admin\Audit;
use Filament\Infolists\Components\KeyValueEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Journal d'audit (FR-H-7) : lecture seule, aucune action, aucune page de création ni de modification. */
class AuditEntryResource extends AdminResource
{
    protected static ?string $model = AuditEntry::class;

    protected static ?string $slug = 'audit-log';

    protected static ?string $modelLabel = 'entrée du journal';

    protected static ?string $pluralModelLabel = 'journal d\'audit';

    protected static ?string $navigationLabel = 'Journal d\'audit';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-clipboard-document-list';

    protected static ?int $navigationSort = 90;

    protected static function isValidRecordKey(int | string $key): bool
    {
        return ctype_digit((string) $key);
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('actor')->latest('id');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('created_at')->label('Date')->dateTime('d/m/Y H:i:s'),
                TextColumn::make('actor.email')->label('Acteur')->placeholder('Système'),
                TextColumn::make('action')->label('Action')->badge()->searchable(),
                TextColumn::make('subject_type')->label('Objet')->placeholder('—'),
                TextColumn::make('subject_id')->label('Identifiant')->placeholder('—')->copyable()->limit(8),
                TextColumn::make('ip')->label('IP')->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('action')->label('Action')
                    ->options(fn (): array => AuditEntry::query()->distinct()->orderBy('action')->pluck('action', 'action')->all()),
            ])
            ->recordUrl(fn (AuditEntry $record): string => static::getUrl('view', ['record' => $record]))
            ->emptyStateHeading('Journal vide');
    }

    public static function infolist(Schema $schema): Schema
    {
        $flat = fn (?array $data): array => collect($data ?? [])->map(fn ($v) => is_scalar($v) || $v === null ? (string) $v : json_encode($v, JSON_UNESCAPED_UNICODE))->all();

        return $schema->components([
            Section::make()->columns(3)->schema([
                TextEntry::make('created_at')->label('Date')->dateTime('d/m/Y H:i:s'),
                TextEntry::make('actor.email')->label('Acteur')->placeholder('Système'),
                TextEntry::make('action')->label('Action')->badge(),
                TextEntry::make('subject_type')->label('Objet')->placeholder('—'),
                TextEntry::make('subject_id')->label('Identifiant')->placeholder('—'),
                TextEntry::make('ip')->label('IP')->placeholder('—'),
            ]),
            Section::make('Avant / après')->columns(2)->schema([
                KeyValueEntry::make('before')->label('Avant')->state(fn (AuditEntry $record): array => $flat(app(Audit::class)->redact($record->before ?? [])))->placeholder('—'),
                KeyValueEntry::make('after')->label('Après')->state(fn (AuditEntry $record): array => $flat(app(Audit::class)->redact($record->after ?? [])))->placeholder('—'),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListAuditEntries::route('/'),
            'view' => ViewAuditEntry::route('/{record}'),
        ];
    }
}
