<?php

namespace App\Filament\Resources;

use App\Filament\Models\Member;
use App\Filament\Resources\MemberResource\Pages\ListMembers;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\MemberResource\RelationManagers\CreditEntriesRelationManager;
use App\Filament\Resources\MemberResource\RelationManagers\RiskEventsRelationManager;
use App\Filament\Resources\MemberResource\RelationManagers\SanctionsRelationManager;
use App\Filament\Support\Staff;
use App\Services\Premium;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Utilisateurs (FR-H-2, FR-H-6). Lecture pour le support et l'admin ; les actions (sanctions, crédits, Premium offert)
 * sont réservées à l'admin et passent par App\Services\Admin\UserAdmin.
 * Aucune donnée secrète : ni hash du mot de passe, ni jeton, ni date de naissance exacte (âge seulement).
 */
class MemberResource extends AdminResource
{
    protected static ?string $model = Member::class;

    protected static ?string $slug = 'users';

    protected static ?string $modelLabel = 'utilisateur';

    protected static ?string $pluralModelLabel = 'utilisateurs';

    protected static ?string $navigationLabel = 'Utilisateurs';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-users';

    protected static ?int $navigationSort = 50;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('profile')->select(['users.id', 'users.email', 'users.phone', 'users.status', 'users.risk_score',
            'users.locale', 'users.birthdate', 'users.email_verified_at', 'users.last_seen_at', 'users.created_at'])->latest('users.created_at');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('email')->label('E-mail')->placeholder('(supprimé)')
                    // Recherche par e-mail, début d'identifiant ou nom d'affichage.
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        $like = Staff::like(trim($search));

                        return $query->where(fn (Builder $q) => $q
                            ->where('users.email', 'ilike', $like)
                            ->orWhereRaw('users.id::text ilike ?', [str_replace('%', '', $like).'%'])
                            ->orWhereHas('profile', fn (Builder $p) => $p->where('display_name', 'ilike', $like)));
                    }),
                TextColumn::make('profile.display_name')->label('Nom')->placeholder('—'),
                TextColumn::make('status')->label('Statut')->badge()
                    ->color(fn ($state) => match ($state) {'active' => 'success', 'suspended' => 'warning', 'banned' => 'danger', default => 'gray'}),
                TextColumn::make('risk_score')->label('Risque')->sortable(),
                TextColumn::make('created_at')->label('Inscrit')->since()->sortable(),
                TextColumn::make('last_seen_at')->label('Vu')->since()->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('status')->label('Statut')->options(['active' => 'Actif', 'suspended' => 'Suspendu', 'banned' => 'Banni', 'deleting' => 'En suppression', 'deleted' => 'Supprimé']),
            ])
            ->recordUrl(fn (Member $record): string => static::getUrl('view', ['record' => $record]))
            ->searchPlaceholder('E-mail, identifiant ou nom');
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Compte')->columns(3)->schema([
                TextEntry::make('id')->label('Identifiant')->copyable(),
                TextEntry::make('email')->label('E-mail')->placeholder('(supprimé)'),
                TextEntry::make('phone')->label('Téléphone')->placeholder('—'),
                TextEntry::make('profile.display_name')->label('Nom d\'affichage')->placeholder('—'),
                TextEntry::make('profile.verification_status')->label('Vérification')->badge()->placeholder('—'),
                TextEntry::make('status')->label('Statut')->badge(),
                TextEntry::make('age')->label('Âge')->state(fn (Member $record): ?int => $record->birthdate?->age),
                TextEntry::make('risk_score')->label('Score de risque'),
                TextEntry::make('created_at')->label('Inscrit')->dateTime(),
                TextEntry::make('last_seen_at')->label('Dernière activité')->dateTime()->placeholder('—'),
            ]),
            Section::make('Monétisation')->columns(4)->schema([
                TextEntry::make('premium')->label('Premium')->state(fn (Member $record): string => Premium::active($record->id) ? 'Actif' : 'Non'),
                ...collect(['conversation' => 'Crédits conversation', 'proposal' => 'Crédits proposition', 'coin' => 'Pièces'])
                    ->map(fn (string $label, string $type) => TextEntry::make('balance_'.$type)->label($label)
                        ->state(fn (Member $record): int => (int) DB::table('credit_ledger')->where('user_id', $record->id)->where('credit_type', $type)->sum('delta')))
                    ->values()->all(),
            ]),
        ]);
    }

    public static function getRelations(): array
    {
        return [SanctionsRelationManager::class, RiskEventsRelationManager::class, CreditEntriesRelationManager::class];
    }

    public static function getPages(): array
    {
        return [
            'index' => ListMembers::route('/'),
            'view' => ViewMember::route('/{record}'),
        ];
    }
}
