<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class RiskEventsRelationManager extends RelationManager
{
    protected static string $relationship = 'riskEvents';

    protected static ?string $title = 'Événements de risque';

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
                TextColumn::make('signal')->label('Signal')->badge(),
                TextColumn::make('weight')->label('Poids'),
                TextColumn::make('created_at')->label('Date')->dateTime(),
            ]);
    }
}
