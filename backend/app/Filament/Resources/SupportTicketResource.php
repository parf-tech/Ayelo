<?php

namespace App\Filament\Resources;

use App\Filament\Models\SupportTicket;
use App\Filament\Resources\SupportTicketResource\Pages\ListSupportTickets;
use App\Filament\Resources\SupportTicketResource\Pages\ViewSupportTicket;
use App\Filament\Resources\SupportTicketResource\TicketActions;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Tickets de support : statut et attribution. */
class SupportTicketResource extends AdminResource
{
    protected static ?string $model = SupportTicket::class;

    protected static ?string $slug = 'tickets';

    protected static ?string $modelLabel = 'ticket';

    protected static ?string $pluralModelLabel = 'tickets de support';

    protected static ?string $navigationLabel = 'Tickets de support';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-lifebuoy';

    protected static ?int $navigationSort = 60;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['member.profile', 'assignee'])->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) SupportTicket::query()->where('status', 'open')->count();
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('subject')->label('Sujet')->limit(60),
                TextColumn::make('member.profile.display_name')->label('Utilisateur')->placeholder('—'),
                TextColumn::make('status')->label('Statut')->badge(),
                TextColumn::make('assignee.email')->label('Attribué à')->placeholder('Non attribué'),
                TextColumn::make('created_at')->label('Reçu')->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label('Statut')->default('open')
                    ->options(['open' => 'Ouvert', 'pending' => 'En attente', 'closed' => 'Fermé']),
            ])
            ->recordUrl(fn (SupportTicket $record): string => static::getUrl('view', ['record' => $record]))
            ->recordActions(TicketActions::make())
            ->emptyStateHeading('Aucun ticket');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Ticket')->columns(3)->schema([
                TextEntry::make('subject')->label('Sujet')->columnSpanFull(),
                TextEntry::make('status')->label('Statut')->badge(),
                TextEntry::make('assignee.email')->label('Attribué à')->placeholder('Non attribué'),
                TextEntry::make('created_at')->label('Reçu')->dateTime(),
                TextEntry::make('body')->label('Message')->columnSpanFull(),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListSupportTickets::route('/'),
            'view' => ViewSupportTicket::route('/{record}'),
        ];
    }
}
