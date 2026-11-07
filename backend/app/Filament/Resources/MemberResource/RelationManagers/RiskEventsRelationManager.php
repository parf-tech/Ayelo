<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use App\Filament\Support\Labels;
use App\Filament\Support\Staff;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class RiskEventsRelationManager extends RelationManager
{
    protected static string $relationship = 'riskEvents';

    public static function getTitle(Model $ownerRecord, string $pageClass): string
    {
        return Staff::t('admin.section.risk_events');
    }

    public function isReadOnly(): bool
    {
        return true;
    }

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return \App\Filament\Support\Staff::can(\App\Services\Admin\Permissions::USERS_MANAGE);
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                Labels::badge(TextColumn::make('signal')->label(Staff::t('admin.col.signal')), 'risk_signal'),
                TextColumn::make('weight')->label(Staff::t('admin.col.weight')),
                TextColumn::make('created_at')->label(Staff::t('admin.col.date'))->dateTime(),
            ]);
    }
}
