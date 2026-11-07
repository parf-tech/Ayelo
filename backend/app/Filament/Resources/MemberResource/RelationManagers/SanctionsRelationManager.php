<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class SanctionsRelationManager extends RelationManager
{
    protected static string $relationship = 'sanctions';

    public static function getTitle(Model $ownerRecord, string $pageClass): string
    {
        return Staff::t('admin.section.sanctions');
    }

    public function isReadOnly(): bool
    {
        return true;
    }

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return \App\Filament\Support\Staff::can(\App\Services\Admin\Permissions::USERS_VIEW);
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Labels::badge(TextColumn::make('kind')->label(Staff::t('admin.col.type')), 'sanction'),
                TextColumn::make('reason')->label(Staff::t('admin.col.reason')),
                TextColumn::make('starts_at')->label(Staff::t('admin.col.start'))->dateTime(),
                TextColumn::make('ends_at')->label(Staff::t('admin.col.end'))->dateTime()->placeholder(Staff::t('admin.misc.no_end')),
            ]);
    }
}
