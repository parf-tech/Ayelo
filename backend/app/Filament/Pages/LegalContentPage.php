<?php

namespace App\Filament\Pages;

use App\Filament\Support\Staff;
use App\Filament\Support\StaffLocale;
use App\Services\Admin\LegalContent;
use App\Services\Admin\Permissions;
use App\Services\Site\LegalCatalog;
use App\Services\Site\LegalPublished;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Pages\Page;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Components\EmbeddedSchema;
use Filament\Schemas\Components\Form;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Components\Attributes\Unexposed;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\HtmlString;

/**
 * Mentions légales du site de présentation : un champ par texte et par langue, brouillon puis publication, bannière provisoire.
 * Réservée au droit `legal.manage` (administrateur) ; toutes les écritures passent par App\Services\Admin\LegalContent, qui vérifie
 * le droit, valide, écrit dans une transaction et journalise.
 */
class LegalContentPage extends Page
{
    protected static ?string $slug = 'legal';

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-scale';

    protected static ?int $navigationSort = 80;

    /** @var array<string, array<string, ?string>>|null clé => langue => texte, état du formulaire */
    public ?array $data = [];

    public static function canAccess(): bool
    {
        return Staff::can(Permissions::LEGAL_MANAGE);
    }

    public static function getNavigationLabel(): string
    {
        return Staff::t('admin.legal.nav');
    }

    public function getTitle(): string|Htmlable
    {
        return Staff::t('admin.legal.title');
    }

    public function getSubheading(): string|Htmlable|null
    {
        $state = app(LegalContent::class)->state();
        $missing = 0;
        $total = 0;
        foreach (array_keys(app(LegalCatalog::class)->slots()) as $key) {
            foreach (['fr', 'en'] as $lang) {
                $total++;
                if (trim((string) ($state[$key][$lang]['published'] ?? '')) === '') {
                    $missing++;
                }
            }
        }

        return trans_choice('admin.legal.missing', $missing, ['count' => $missing, 'total' => $total], StaffLocale::resolve())
            .' '.Staff::t('admin.legal.hint');
    }

    public function mount(): void
    {
        $this->form->fill($this->storedTexts());
    }

    #[Unexposed]
    public function defaultForm(Schema $schema): Schema
    {
        return $schema->statePath('data');
    }

    #[Unexposed]
    public function form(Schema $schema): Schema
    {
        return $schema->components($this->sections());
    }

    #[Unexposed]
    public function content(Schema $schema): Schema
    {
        return $schema->components([
            Form::make([EmbeddedSchema::make('form')])->id('form')->livewireSubmitHandler('saveDraft'),
        ]);
    }

    /** @return array<Action> */
    protected function getHeaderActions(): array
    {
        return [
            Action::make('saveDraft')
                ->label(Staff::t('admin.legal.save'))
                ->color('gray')
                ->action(fn () => $this->saveDraft()),
            Action::make('discard')
                ->label(Staff::t('admin.legal.discard'))
                ->color('gray')
                ->requiresConfirmation()
                ->modalHeading(Staff::t('admin.legal.discard_heading'))
                ->modalDescription(Staff::t('admin.legal.discard_body'))
                ->action(fn () => $this->discardDrafts()),
            Action::make('banner')
                ->label(fn (): string => Staff::t($this->bannerVisible() ? 'admin.legal.banner_hide' : 'admin.legal.banner_show'))
                ->color('warning')
                ->requiresConfirmation()
                ->modalHeading(fn (): string => Staff::t($this->bannerVisible() ? 'admin.legal.banner_hide_heading' : 'admin.legal.banner_show_heading'))
                ->modalDescription(fn (): string => Staff::t($this->bannerVisible() ? 'admin.legal.banner_hide_body' : 'admin.legal.banner_show_body'))
                ->action(fn () => $this->toggleBanner()),
            Action::make('publish')
                ->label(Staff::t('admin.legal.publish'))
                ->color('primary')
                ->requiresConfirmation()
                ->modalHeading(Staff::t('admin.legal.publish_heading'))
                ->modalDescription(fn (): Htmlable => $this->changeList())
                ->modalSubmitActionLabel(Staff::t('admin.legal.publish'))
                ->disabled(fn (): bool => $this->changedFields() === [])
                ->action(fn () => $this->publishAll()),
        ];
    }

    /** Envoi du formulaire (touche Entrée) et bouton « Enregistrer le brouillon ». */
    public function saveDraft(): void
    {
        $values = $this->formValues();
        // En cas de refus, le formulaire garde la saisie : la recharger depuis la base ferait perdre tout ce qui vient d'être tapé.
        if (Staff::run(fn () => app(LegalContent::class)->saveDraft(Staff::current(), $values), Staff::t('admin.legal.saved'))) {
            $this->form->fill($this->storedTexts());
        }
    }

    protected function publishAll(): void
    {
        $values = $this->formValues();
        $done = Staff::run(function () use ($values): void {
            $service = app(LegalContent::class);
            $service->saveDraft(Staff::current(), $values);
            $service->publish(Staff::current());
        }, Staff::t('admin.legal.published'));
        if ($done) {
            $this->form->fill($this->storedTexts());
        }
    }

    protected function discardDrafts(): void
    {
        Staff::run(fn () => app(LegalContent::class)->discard(Staff::current()), Staff::t('admin.legal.discarded'));
        $this->form->fill($this->storedTexts());
    }

    protected function toggleBanner(): void
    {
        $visible = $this->bannerVisible();
        Staff::run(fn () => app(LegalContent::class)->setBannerVisible(Staff::current(), ! $visible), Staff::t($visible ? 'admin.legal.banner_hidden' : 'admin.legal.banner_shown'));
    }

    private function bannerVisible(): bool
    {
        return app(LegalPublished::class)->bannerVisible();
    }

    /**
     * Texte à afficher dans chaque champ : le brouillon s'il existe, sinon le texte publié, sinon vide.
     *
     * @return array<string, array<string, string>>
     */
    private function storedTexts(): array
    {
        $state = app(LegalContent::class)->state();
        $texts = [];
        foreach (array_keys(app(LegalCatalog::class)->slots()) as $key) {
            foreach (['fr', 'en'] as $lang) {
                $row = $state[$key][$lang] ?? ['draft' => null, 'published' => null];
                $texts[$key][$lang] = $row['draft'] ?? $row['published'] ?? '';
            }
        }

        return $texts;
    }

    /**
     * Valeurs validées du formulaire (longueurs maximales), une chaîne par champ et par langue : un champ vidé efface le texte.
     *
     * @return array<string, array<string, string>>
     */
    private function formValues(): array
    {
        $state = $this->form->getState();
        $values = [];
        foreach (array_keys(app(LegalCatalog::class)->slots()) as $key) {
            foreach (['fr', 'en'] as $lang) {
                $values[$key][$lang] = (string) ($state[$key][$lang] ?? '');
            }
        }

        return $values;
    }

    /**
     * Champs dont la saisie diffère du texte publié (`clé.langue`), d'après le formulaire tel qu'il est affiché.
     *
     * @return list<string>
     */
    private function changedFields(): array
    {
        $raw = $this->form->getRawState();
        $state = app(LegalContent::class)->state();
        $changed = [];
        foreach (array_keys(app(LegalCatalog::class)->slots()) as $key) {
            foreach (['fr', 'en'] as $lang) {
                $typed = trim(str_replace(["\r\n", "\r"], "\n", (string) ($raw[$key][$lang] ?? '')));
                if ($typed !== (string) ($state[$key][$lang]['published'] ?? '')) {
                    $changed[] = "{$key}.{$lang}";
                }
            }
        }

        return $changed;
    }

    private function changeList(): Htmlable
    {
        $slots = app(LegalCatalog::class)->slots();
        $locale = StaffLocale::resolve();
        $items = '';
        foreach ($this->changedFields() as $field) {
            [$key, $lang] = explode('.', $field);
            $label = $slots[$key]['label'][$locale] ?? $slots[$key]['label']['fr'];
            $items .= '<li>'.e($label.' · '.Staff::t("admin.legal.lang.{$lang}")).'</li>';
        }

        return new HtmlString('<p>'.e(Staff::t('admin.legal.publish_body')).'</p><ul class="list-disc ps-6 mt-2">'.$items.'</ul>');
    }

    /** @return list<Section> */
    private function sections(): array
    {
        $catalog = app(LegalCatalog::class);
        $locale = StaffLocale::resolve();
        $sections = [];
        foreach ($catalog->groups() as $group => $keys) {
            $rows = [];
            foreach ($keys as $key) {
                $slot = $catalog->slots()[$key];
                $label = $slot['label'][$locale] ?? $slot['label']['fr'];
                $rows[] = Grid::make(['default' => 1, 'md' => 2])->schema(array_map(
                    fn (string $lang): Component => $this->field($key, $lang, $slot, $label),
                    ['fr', 'en'],
                ));
            }
            $sections[] = Section::make(Staff::t("admin.legal.groups.{$group}"))->schema($rows)->collapsible();
        }

        return $sections;
    }

    /** @param  array<string, mixed>  $slot */
    private function field(string $key, string $lang, array $slot, string $label): Component
    {
        $field = match (true) {
            $slot['kind'] === 'block' => Textarea::make("{$key}.{$lang}")->rows(6),
            ($slot['multiline'] ?? false) === true => Textarea::make("{$key}.{$lang}")->rows(3), // adresse : un saut de ligne = une ligne de l'adresse
            default => TextInput::make("{$key}.{$lang}"),
        };

        return $field
            ->label($label.' · '.Staff::t("admin.legal.lang.{$lang}"))
            ->helperText($slot['hint'][$lang])
            ->maxLength((int) $slot['max']);
    }
}
