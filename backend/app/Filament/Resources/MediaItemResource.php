<?php

namespace App\Filament\Resources;

use App\Filament\Models\MediaItem;
use App\Filament\Resources\MediaItemResource\Pages\ListMediaItems;
use App\Filament\Support\Labels;
use App\Filament\Support\Mask;
use App\Filament\Support\Staff;
use App\Services\Admin\MediaModeration;
use App\Services\Admin\Permissions;
use Filament\Actions\Action;
use Filament\Forms\Components\Select;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\HtmlString;

/** File « Médias à modérer » (FR-H-4) : statut processing, les plus anciens d'abord. Aperçu par URL signée, dans une fenêtre modale. */
class MediaItemResource extends AdminResource
{
    protected static ?string $model = MediaItem::class;

    protected static ?string $slug = 'media-queue';

    protected static string $labelKey = 'media';

    protected static string | \BackedEnum | null $navigationIcon = 'heroicon-o-photo';

    protected static ?int $navigationSort = 10;

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('status', 'processing')->where('kind', '<>', 'verification_selfie')->orderBy('created_at');
    }

    public static function getNavigationBadge(): ?string
    {
        return (string) static::getEloquentQuery()->count();
    }

    /** Contenu de la fenêtre d'aperçu : média flouté tant que le modérateur n'a pas cliqué « Afficher » (protection face aux contenus explicites). */
    public static function previewHtml(?string $url, ?string $mime): HtmlString
    {
        if ($url === null) {
            return new HtmlString('<p>'.e(Staff::t('admin.media.preview_unavailable')).'</p>');
        }
        $src = e($url);
        $blur = 'filter:blur(28px);';
        $style = 'max-width:100%;max-height:65vh;margin:0 auto;display:block;border-radius:.5rem;';
        $bound = 'x-bind:style="shown ? \'\' : \''.$blur.'\'"';
        $media = match (true) {
            str_starts_with((string) $mime, 'video/') => '<video src="'.$src.'" controls preload="metadata" style="'.$style.$blur.'" '.$bound.'></video>',
            str_starts_with((string) $mime, 'audio/') => '<audio src="'.$src.'" controls style="width:100%"></audio>',
            default => '<img src="'.$src.'" alt="'.e(Staff::t('admin.media.preview_alt')).'" style="'.$style.$blur.'" '.$bound.'>',
        };

        return new HtmlString(
            '<div x-data="{ shown: false }" style="display:grid;gap:.75rem">'.$media
            .'<div style="text-align:center"><button type="button" x-show="!shown" x-on:click="shown = true" class="fi-link fi-size-md" style="text-decoration:underline">'
            .e(Staff::t('admin.media.reveal')).'</button></div>'
            .'<p class="fi-fo-field-wrp-hint" style="text-align:center;font-size:.8rem">'
            .e(Staff::t('admin.media.link_expires', ['minutes' => (int) config('media.read_ttl_minutes', 10)])).'</p></div>'
        );
    }

    public static function table(Table $table): Table
    {
        $moderate = fn (): bool => Staff::can(Permissions::MEDIA_MODERATE);

        return $table
            ->columns([
                Labels::badge(TextColumn::make('kind')->label(Staff::t('admin.col.type')), 'media_kind'),
                // Minimisation (revue N-09) : l'e-mail n'est montré qu'au rôle qui peut déjà consulter les comptes, et masqué en liste.
                TextColumn::make('owner.email')->label(Staff::t('admin.col.user'))->visible(fn () => Staff::can(Permissions::USERS_VIEW))
                    ->formatStateUsing(fn (?string $state): ?string => Mask::email($state)),
                TextColumn::make('mime_type')->label(Staff::t('admin.col.format')),
                TextColumn::make('size_bytes')->label(Staff::t('admin.col.size'))->formatStateUsing(fn ($state) => $state ? number_format($state / 1024, 0, ',', ' ').' '.Staff::t('admin.misc.kb') : '—'),
                TextColumn::make('created_at')->label(Staff::t('admin.col.uploaded'))->since(),
            ])
            ->filters([
                SelectFilter::make('kind')->label(Staff::t('admin.col.type'))
                    ->options(Labels::options('media_kind', ['profile_photo', 'profile_video', 'message_image', 'message_video', 'message_voice', 'story', 'invite_video'])),
            ])
            ->recordActions([
                Action::make('preview')->label(Staff::t('admin.action.preview'))->icon('heroicon-o-eye')->color('gray')
                    ->visible($moderate)
                    // L'URL signée courte n'est produite qu'à l'ouverture de la fenêtre, et l'ouverture est journalisée (« media.preview », revue N-09) :
                    // l'écriture du journal précède donc toujours l'accès au fichier. (Le journal enregistre la génération de l'URL,
                    // pas le chargement effectif de l'image par le navigateur.) Chemin audité inchangé : MediaModeration::preview.
                    ->mountUsing(function (MediaItem $record, $livewire): void {
                        $livewire->previewUrl = null;
                        $livewire->previewMime = $record->mime_type;
                        Staff::run(function () use ($record, $livewire): void {
                            $livewire->previewUrl = app(MediaModeration::class)->preview(Staff::current(), $record->id);
                        }, Staff::t('admin.notify.preview_logged'));
                    })
                    ->modalHeading(Staff::t('admin.media.preview_title'))
                    ->modalContent(fn ($livewire): HtmlString => static::previewHtml($livewire->previewUrl, $livewire->previewMime))
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel(Staff::t('admin.action.close'))
                    ->action(fn () => null),
                // Action fréquente et réversible en pratique : pas de confirmation (la décision reste journalisée).
                Action::make('approve')->label(Staff::t('admin.action.approve'))->icon('heroicon-o-check')->color('success')
                    ->visible($moderate)
                    ->action(fn (MediaItem $record) => Staff::run(
                        fn () => app(MediaModeration::class)->approve(Staff::current(), $record->id), Staff::t('admin.notify.media_approved'))),
                Action::make('reject')->label(Staff::t('admin.action.reject'))->icon('heroicon-o-x-mark')->color('danger')
                    ->visible($moderate)
                    ->requiresConfirmation()
                    ->modalDescription(Staff::t('admin.confirm.media.reject'))
                    ->schema([
                        Select::make('label')->label(Staff::t('admin.field.reason'))->required()
                            ->options(Labels::options('reject_label', MediaModeration::REJECT_LABELS)),
                    ])
                    ->action(fn (MediaItem $record, array $data) => Staff::run(
                        fn () => app(MediaModeration::class)->reject(Staff::current(), $record->id, $data['label']), Staff::t('admin.notify.media_rejected'))),
            ])
            ->emptyStateHeading(Staff::t('admin.empty.media'));
    }

    public static function getPages(): array
    {
        return ['index' => ListMediaItems::route('/')];
    }
}
