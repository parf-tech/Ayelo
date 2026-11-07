<?php

namespace App\Filament\Resources;

use App\Filament\Models\Appeal;
use App\Filament\Resources\AppealResource\AppealActions;
use App\Filament\Resources\AppealResource\Pages\ListAppeals;
use App\Filament\Resources\AppealResource\Pages\ViewAppeal;
use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
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

    protected static string $labelKey = 'appeal';

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
                TextColumn::make('member.profile.display_name')->label(Staff::t('admin.col.user'))->placeholder('—'),
                Labels::badge(TextColumn::make('sanction.kind')->label(Staff::t('admin.col.sanction')), 'sanction'),
                TextColumn::make('message')->label(Staff::t('admin.col.message'))->limit(80),
                Labels::badge(TextColumn::make('status')->label(Staff::t('admin.col.status')), 'appeal'),
                TextColumn::make('created_at')->label(Staff::t('admin.col.received_f'))->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label(Staff::t('admin.col.status'))->default('open')
                    ->options(Labels::options('appeal', ['open', 'accepted', 'rejected'])),
            ])
            ->recordUrl(fn (Appeal $record): string => static::getUrl('view', ['record' => $record]))
            ->recordActions(AppealActions::make())
            ->emptyStateHeading(Staff::t('admin.empty.appeals'));
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make(Staff::t('admin.section.appeal'))->columns(3)->schema([
                Labels::badge(TextEntry::make('status')->label(Staff::t('admin.col.status')), 'appeal'),
                TextEntry::make('created_at')->label(Staff::t('admin.col.received_f'))->dateTime(),
                TextEntry::make('decision_note')->label(Staff::t('admin.col.decision_note'))->placeholder('—'),
                TextEntry::make('message')->label(Staff::t('admin.col.user_message'))->columnSpanFull(),
            ]),
            Section::make(Staff::t('admin.section.contested_sanction'))->columns(3)->schema([
                Labels::badge(TextEntry::make('sanction.kind')->label(Staff::t('admin.col.type')), 'sanction'),
                TextEntry::make('sanction.reason')->label(Staff::t('admin.col.reason_shown')),
                TextEntry::make('sanction.ends_at')->label(Staff::t('admin.col.end'))->dateTime()->placeholder(Staff::t('admin.misc.no_end')),
                Labels::badge(TextEntry::make('member.status')->label(Staff::t('admin.col.account_status')), 'account'),
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
