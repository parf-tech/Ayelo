<?php

namespace App\Filament\Resources;

use App\Filament\Models\VerificationRequest;
use App\Filament\Resources\VerificationRequestResource\Pages\ListVerificationRequests;
use App\Filament\Resources\VerificationRequestResource\Pages\ViewVerificationRequest;
use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
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

    protected static string $labelKey = 'verification';

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
                TextColumn::make('member.profile.display_name')->label(Staff::t('admin.col.user'))->placeholder('—'),
                TextColumn::make('pose_code')->label(Staff::t('admin.col.pose')),
                Labels::badge(TextColumn::make('status')->label(Staff::t('admin.col.status')), 'verification'),
                TextColumn::make('created_at')->label(Staff::t('admin.col.received_f'))->since(),
            ])
            ->filters([
                SelectFilter::make('status')->label(Staff::t('admin.col.status'))->default('pending')
                    ->options(Labels::options('verification', ['pending', 'approved', 'rejected'])),
            ])
            ->recordUrl(fn (VerificationRequest $record): string => static::getUrl('view', ['record' => $record]))
            ->emptyStateHeading(Staff::t('admin.empty.verifications'));
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make(Staff::t('admin.section.request'))->columns(3)->schema([
                TextEntry::make('member.profile.display_name')->label(Staff::t('admin.col.user'))->placeholder('—'),
                TextEntry::make('pose_code')->label(Staff::t('admin.col.pose')),
                Labels::badge(TextEntry::make('status')->label(Staff::t('admin.col.status')), 'verification'),
                TextEntry::make('reject_reason')->label(Staff::t('admin.col.reject_reason'))->placeholder('—'),
                TextEntry::make('created_at')->label(Staff::t('admin.col.received_f'))->dateTime(),
            ]),
            Section::make(Staff::t('admin.section.selfie'))->schema([
                TextEntry::make('selfie')->hiddenLabel()->html()
                    ->state(fn ($livewire): ?HtmlString => $livewire->selfieUrl
                        ? new HtmlString('<img src="'.e($livewire->selfieUrl).'" alt="'.e(Staff::t('admin.verification.selfie_alt')).'" style="max-width:24rem;border-radius:.5rem">')
                        : null)
                    ->placeholder(Staff::t('admin.verification.selfie_placeholder')),
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
