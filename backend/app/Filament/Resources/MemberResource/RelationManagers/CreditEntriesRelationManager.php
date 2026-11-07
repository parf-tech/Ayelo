<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class CreditEntriesRelationManager extends RelationManager
{
    protected static string $relationship = 'creditEntries';

    public static function getTitle(Model $ownerRecord, string $pageClass): string
    {
        return Staff::t('admin.section.credit_ledger');
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
                Labels::badge(TextColumn::make('credit_type')->label(Staff::t('admin.col.type')), 'credit_type'),
                TextColumn::make('delta')->label(Staff::t('admin.col.delta')),
                TextColumn::make('reason')->label(Staff::t('admin.col.reason')),
                TextColumn::make('note')->label(Staff::t('admin.col.note'))->placeholder('—')->limit(60),
                TextColumn::make('created_at')->label(Staff::t('admin.col.date'))->dateTime(),
            ]);
    }
}
