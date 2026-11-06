<?php

namespace App\Filament\Resources\MemberResource\RelationManagers;

use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class CreditEntriesRelationManager extends RelationManager
{
    protected static string $relationship = 'creditEntries';

    protected static ?string $title = 'Registre des crédits';

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
                TextColumn::make('credit_type')->label('Type')->badge(),
                TextColumn::make('delta')->label('Variation'),
                TextColumn::make('reason')->label('Raison'),
                TextColumn::make('note')->label('Note')->placeholder('—')->limit(60),
                TextColumn::make('created_at')->label('Date')->dateTime(),
            ]);
    }
}
