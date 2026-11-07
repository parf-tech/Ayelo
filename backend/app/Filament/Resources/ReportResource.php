<?php

namespace App\Filament\Resources;

use App\Filament\Models\Report;
use App\Filament\Models\Sanction;
use App\Filament\Resources\ReportResource\Pages\ListReports;
use App\Filament\Resources\ReportResource\Pages\ViewReport;
use App\Filament\Resources\ReportResource\ReportActions;
use App\Filament\Support\Labels;
use App\Filament\Support\Sla;
use App\Filament\Support\Staff;
use App\Services\Admin\Permissions;
use Filament\Infolists\Components\TextEntry;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * File « Signalements » (FR-H-5) : priorité décroissante, puis les plus anciens d'abord (délais 24 h / 2 h, docs/11).
 * La fiche donne le contexte de la décision (compte signalé, crédibilité du signalant, sanctions antérieures, délai).
 * Aucun extrait de conversation : aucun rôle ne détient de droit de lecture des messages (matrice Permissions), donc la fiche n'en charge aucun.
 */
class ReportResource extends AdminResource
{
    protected static ?string $model = Report::class;

    protected static ?string $slug = 'reports';

    protected static string $labelKey = 'report';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-flag';

    protected static ?int $navigationSort = 20;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with(['reported.profile', 'reporter.profile'])->orderByDesc('priority')->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) Report::query()->where('status', 'open')->count();
    }

    /** Rouge dès qu'un signalement critique (mineur suspecté, délai de 2 h) est ouvert. */
    public static function getNavigationBadgeColor(): string | array | null
    {
        return Report::query()->where('status', 'open')->where('priority', 2)->exists() ? 'danger' : 'warning';
    }

    /** Prochain signalement à traiter : le plus ancien encore ouvert au même niveau de priorité. */
    public static function nextUrl(Report $current): ?string
    {
        $next = Report::query()->whereIn('status', ['open', 'reviewed'])->where('id', '<>', $current->id)
            ->where('priority', $current->priority)->orderBy('created_at')->first(['id']);

        return $next ? static::getUrl('view', ['record' => $next]) : null;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Labels::badge(TextColumn::make('priority')->label(Staff::t('admin.col.priority')), 'priority'),
                TextColumn::make('reason')->label(Staff::t('admin.col.reason'))->formatStateUsing(fn ($state) => Staff::t('admin.reasons.'.$state)),
                TextColumn::make('reported.profile.display_name')->label(Staff::t('admin.col.reported'))->placeholder('—'),
                Labels::badge(TextColumn::make('reported.status')->label(Staff::t('admin.col.account')), 'account'),
                Labels::badge(TextColumn::make('status')->label(Staff::t('admin.col.status')), 'report'),
                TextColumn::make('created_at')->label(Staff::t('admin.col.received'))->since(),
                TextColumn::make('sla')->label(Staff::t('admin.col.sla'))->badge()
                    ->state(fn (Report $record): string => Sla::text($record))
                    ->color(fn (Report $record): string => Sla::color($record)),
            ])
            ->filters([
                SelectFilter::make('status')->label(Staff::t('admin.col.status'))->default('open')
                    ->options(Labels::options('report', ['open', 'reviewed', 'actioned', 'dismissed'])),
                SelectFilter::make('priority')->label(Staff::t('admin.col.priority'))
                    ->options(fn (): array => [0 => Staff::t('admin.priority.0'), 1 => Staff::t('admin.priority.1'), 2 => Staff::t('admin.priority.2')]),
                SelectFilter::make('reason')->label(Staff::t('admin.col.reason'))
                    ->options(fn (): array => collect(['money_request', 'harassment', 'meeting_behavior', 'fake_or_spam', 'minor_suspected', 'other'])
                        ->mapWithKeys(fn (string $r): array => [$r => Staff::t('admin.reasons.'.$r)])->all()),
                Filter::make('overdue')->label(Staff::t('admin.filter.overdue'))->toggle()
                    ->query(fn (Builder $query): Builder => $query->whereIn('status', ['open', 'reviewed'])
                        ->whereRaw("created_at < now() - (case when reason = 'minor_suspected' or priority >= 2 then interval '".Sla::CRITICAL_HOURS." hours' else interval '".Sla::STANDARD_HOURS." hours' end)")),
            ])
            ->recordUrl(fn (Report $record): string => static::getUrl('view', ['record' => $record]))
            ->recordActions(ReportActions::make())
            ->emptyStateHeading(Staff::t('admin.empty.reports'));
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make(Staff::t('admin.section.report'))->columns(3)->schema([
                TextEntry::make('reason')->label(Staff::t('admin.col.reason'))->formatStateUsing(fn ($state) => Staff::t('admin.reasons.'.$state)),
                Labels::badge(TextEntry::make('priority')->label(Staff::t('admin.col.priority')), 'priority'),
                Labels::badge(TextEntry::make('status')->label(Staff::t('admin.col.status')), 'report'),
                TextEntry::make('details')->label(Staff::t('admin.col.reporter_details'))->columnSpanFull()->placeholder('—'),
                TextEntry::make('context_type')->label(Staff::t('admin.col.context'))->placeholder('—')
                    ->formatStateUsing(fn ($state): string => Labels::text('context', $state)),
                TextEntry::make('created_at')->label(Staff::t('admin.col.received'))->dateTime(),
                Labels::badge(TextEntry::make('outcome')->label(Staff::t('admin.col.decision'))->placeholder('—'), 'outcome'),
                TextEntry::make('sla_due')->label(Staff::t('admin.col.sla_due'))
                    ->state(fn (Report $record): string => Sla::dueText($record)),
                TextEntry::make('sla')->label(Staff::t('admin.col.sla'))->badge()
                    ->state(fn (Report $record): string => Sla::text($record))
                    ->color(fn (Report $record): string => Sla::color($record)),
            ]),
            Section::make(Staff::t('admin.section.reported'))->columns(3)->schema([
                TextEntry::make('reported.profile.display_name')->label(Staff::t('admin.col.name'))->placeholder('—')
                    // Lien vers la fiche : seulement pour qui peut consulter les comptes (users.view), jamais pour le modérateur.
                    ->url(fn (Report $record): ?string => Staff::can(Permissions::USERS_VIEW) && $record->reported_id ? MemberResource::getUrl('view', ['record' => $record->reported_id]) : null),
                Labels::badge(TextEntry::make('reported.status')->label(Staff::t('admin.col.account_status')), 'account'),
                TextEntry::make('reported.risk_score')->label(Staff::t('admin.col.risk_score')),
                TextEntry::make('sanctions_count')->label(Staff::t('admin.col.sanctions_before'))
                    ->state(fn (Report $record): int => $record->reported->sanctions()->count()),
                TextEntry::make('open_on_target')->label(Staff::t('admin.col.open_on_target'))
                    ->state(fn (Report $record): int => Report::query()->where('reported_id', $record->reported_id)->whereIn('status', ['open', 'reviewed'])->count()),
                TextEntry::make('past_sanctions')->label(Staff::t('admin.col.sanction_history'))->columnSpanFull()
                    ->listWithLineBreaks()->bulleted()->placeholder(Staff::t('admin.misc.none'))
                    ->state(fn (Report $record): array => Sanction::query()->where('user_id', $record->reported_id)->latest('created_at')->limit(5)->get()
                        ->map(fn (Sanction $s): string => Labels::text('sanction', $s->kind).' · '.$s->created_at?->format('d/m/Y').($s->reason ? ' · '.$s->reason : ''))->all()),
            ]),
            Section::make(Staff::t('admin.section.reporter'))->columns(3)->schema([
                TextEntry::make('reporter.profile.display_name')->label(Staff::t('admin.col.name'))->placeholder(Staff::t('admin.misc.deleted_account')),
                TextEntry::make('reporter_credibility')->label(Staff::t('admin.col.credibility'))->columnSpan(2)
                    ->state(function (Report $record): string {
                        if ($record->reporter_id === null) {
                            return '—';
                        }
                        $stats = DB::table('reports')->where('reporter_id', $record->reporter_id)
                            ->selectRaw("count(*) as total, count(*) filter (where status = 'actioned') as actioned, count(*) filter (where status = 'dismissed') as dismissed")->first();

                        return Staff::t('admin.misc.credibility', ['total' => (int) $stats->total, 'actioned' => (int) $stats->actioned, 'dismissed' => (int) $stats->dismissed]);
                    }),
            ]),
            Section::make(Staff::t('admin.section.conversation'))->schema([
                TextEntry::make('conversation_notice')->hiddenLabel()
                    ->state(fn (): string => Staff::t('admin.misc.no_message_access')),
            ]),
        ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListReports::route('/'),
            'view' => ViewReport::route('/{record}'),
        ];
    }
}
