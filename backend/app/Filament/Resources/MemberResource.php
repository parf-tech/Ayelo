<?php

namespace App\Filament\Resources;

use App\Filament\Models\Member;
use App\Filament\Resources\MemberResource\Pages\ListMembers;
use App\Filament\Resources\MemberResource\Pages\ViewMember;
use App\Filament\Resources\MemberResource\RelationManagers\CreditEntriesRelationManager;
use App\Filament\Resources\MemberResource\RelationManagers\RiskEventsRelationManager;
use App\Filament\Resources\MemberResource\RelationManagers\SanctionsRelationManager;
use App\Filament\Support\Labels;
use App\Filament\Support\Mask;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
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

    protected static string $labelKey = 'member';

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-users';

    protected static ?int $navigationSort = 50;

    /**
     * Minimisation (revue N-09) : le téléphone et le score de risque ne concernent pas le support (qui peut consulter les comptes,
     * USERS_VIEW) ; ils exigent USERS_MANAGE (administrateur). Appliqué à la requête : les colonnes ne sont même pas chargées,
     * donc elles ne fuient ni par la table, ni par la fiche, ni par une réponse Livewire.
     */
    public static function canSeeSensitive(): bool
    {
        return Staff::can(Permissions::USERS_MANAGE);
    }

    public static function getEloquentQuery(): Builder
    {
        $columns = ['users.id', 'users.email', 'users.status', 'users.locale', 'users.birthdate', 'users.email_verified_at', 'users.last_seen_at', 'users.created_at'];
        if (static::canSeeSensitive()) {
            $columns = [...$columns, 'users.phone', 'users.risk_score'];
        }

        return parent::getEloquentQuery()->with('profile')->select($columns)->latest('users.created_at');
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                // Minimisation : l'e-mail est masqué en liste (a***@e***.com) ; la fiche, réservée à users.view, l'affiche en entier.
                // La recherche porte toujours sur la vraie valeur.
                TextColumn::make('email')->label(Staff::t('admin.col.email'))->placeholder(Staff::t('admin.misc.deleted'))
                    ->formatStateUsing(fn (?string $state): ?string => Mask::email($state))
                    // Recherche par e-mail, début d'identifiant ou nom d'affichage.
                    ->searchable(query: function (Builder $query, string $search): Builder {
                        $like = Staff::like(trim($search));

                        return $query->where(fn (Builder $q) => $q
                            ->where('users.email', 'ilike', $like)
                            ->orWhereRaw('users.id::text ilike ?', [str_replace('%', '', $like).'%'])
                            ->orWhereHas('profile', fn (Builder $p) => $p->where('display_name', 'ilike', $like)));
                    }),
                TextColumn::make('profile.display_name')->label(Staff::t('admin.col.name'))->placeholder('—'),
                Labels::badge(TextColumn::make('status')->label(Staff::t('admin.col.status')), 'account'),
                TextColumn::make('risk_score')->label(Staff::t('admin.col.risk'))->sortable()->visible(fn () => static::canSeeSensitive()),
                TextColumn::make('created_at')->label(Staff::t('admin.col.signed_up'))->since()->sortable(),
                TextColumn::make('last_seen_at')->label(Staff::t('admin.col.seen'))->since()->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('status')->label(Staff::t('admin.col.status'))->options(Labels::options('account', ['active', 'suspended', 'banned', 'deleting', 'deleted'])),
            ])
            ->recordUrl(fn (Member $record): string => static::getUrl('view', ['record' => $record]))
            ->searchPlaceholder(Staff::t('admin.misc.member_search'));
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make(Staff::t('admin.section.account'))->columns(3)->schema([
                TextEntry::make('id')->label(Staff::t('admin.col.identifier'))->copyable(),
                // Fiche réservée au rôle users.view (MemberPolicy) : l'e-mail complet n'est montré qu'ici, jamais en liste.
                TextEntry::make('email')->label(Staff::t('admin.col.email'))->placeholder(Staff::t('admin.misc.deleted'))
                    ->visible(fn () => Staff::can(Permissions::USERS_VIEW)),
                TextEntry::make('phone')->label(Staff::t('admin.col.phone'))->placeholder('—')->visible(fn () => static::canSeeSensitive()),
                TextEntry::make('profile.display_name')->label(Staff::t('admin.col.display_name'))->placeholder('—'),
                Labels::badge(TextEntry::make('profile.verification_status')->label(Staff::t('admin.col.verification'))->placeholder('—'), 'profile'),
                Labels::badge(TextEntry::make('status')->label(Staff::t('admin.col.status')), 'account'),
                TextEntry::make('age')->label(Staff::t('admin.col.age'))->state(fn (Member $record): ?int => $record->birthdate?->age),
                TextEntry::make('risk_score')->label(Staff::t('admin.col.risk_score'))->visible(fn () => static::canSeeSensitive()),
                TextEntry::make('created_at')->label(Staff::t('admin.col.signed_up'))->dateTime(),
                TextEntry::make('last_seen_at')->label(Staff::t('admin.col.last_activity'))->dateTime()->placeholder('—'),
            ]),
            Section::make(Staff::t('admin.section.monetization'))->columns(4)->schema([
                TextEntry::make('premium')->label('Premium')->state(fn (Member $record): string => Staff::t(Premium::active($record->id) ? 'admin.misc.active' : 'admin.misc.no')),
                ...collect(['conversation' => 'admin.col.credits_conversation', 'proposal' => 'admin.col.credits_proposal', 'coin' => 'admin.col.coins'])
                    ->map(fn (string $label, string $type) => TextEntry::make('balance_'.$type)->label(Staff::t($label))
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
