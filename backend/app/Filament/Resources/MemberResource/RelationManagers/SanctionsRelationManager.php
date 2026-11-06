<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class SanctionsRelationManager extends RelationManager
{
    protected static string $relationship = 'sanctions';

    protected static ?string $title = 'Sanctions';

    public function isReadOnly(): bool
    {
        return true;
    }

    public static function canViewForRecord(Model $ownerRecord, string $pageClass): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('kind')->label('Type')->badge(),
                TextColumn::make('reason')->label('Motif'),
                TextColumn::make('starts_at')->label('Début')->dateTime(),
                TextColumn::make('ends_at')->label('Fin')->dateTime()->placeholder('Sans fin'),
            ]);
    }
}
