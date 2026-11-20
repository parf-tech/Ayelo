<?php

namespace Tests\Support;

/**
 * Racine de site de test pour les mentions légales : un catalogue `tools/legal-slots.json` et quelques pages HTML au balisage
 * exact du générateur (web/tools/build.py). Écrit dans un dossier temporaire et pointe `site.web_root` dessus.
 */
final class LegalFixture
{
    /** @return array<string, array<string, mixed>> */
    public static function slots(): array
    {
        return [
            'contact_privacy_email' => [
                'group' => 'contacts', 'kind' => 'line', 'max' => 300, 'pages' => ['terms', 'support'],
                'label' => ['fr' => 'E-mail pour les données personnelles', 'en' => 'Personal data e-mail'],
                'hint' => ['fr' => 'privacy@example.invalid', 'en' => 'privacy@example.invalid'],
            ],
            'terms_pricing' => [
                'group' => 'terms', 'kind' => 'block', 'max' => 5000, 'pages' => ['terms'],
                'label' => ['fr' => 'Prix et rétractation', 'en' => 'Prices and withdrawal'],
                'hint' => ['fr' => 'prix, durées', 'en' => 'prices, durations'],
            ],
        ];
    }

    /** Page de test : bannière, un champ ligne, un champ bloc. */
    public static function html(string $lang): string
    {
        $todo = $lang === 'en' ? '[TO BE COMPLETED: %s]' : '[À COMPLÉTER : %s]';

        return '<!doctype html><html lang="'.$lang.'"><head><title>t</title></head><body>'."\n"
            .'<div class="banner" role="note" data-legal-banner><div class="wrap"><p>Version provisoire</p></div></div>'."\n"
            .'<main><div class="wrap">'."\n"
            .'<p>Contact : <mark class="todo" data-legal="contact_privacy_email">'.sprintf($todo, 'privacy@example.invalid').'</mark></p>'."\n"
            .'<div data-legal-block="terms_pricing"><p><mark class="todo">'.sprintf($todo, 'prix').'</mark></p></div>'."\n"
            .'</div></main></body></html>'."\n";
    }

    /**
     * @param  array<string, array<string, mixed>>|null  $slots  catalogue (défaut : self::slots())
     * @param  array<string, string>|null  $pages  chemin relatif => contenu (défaut : quatre pages FR et leurs miroirs EN)
     * @return string dossier racine du site de test
     */
    public static function make(?array $slots = null, ?array $pages = null): string
    {
        $slots ??= self::slots();
        if ($pages === null) {
            $pages = [];
            foreach (['index.html', 'legal/terms.html', 'support.html', 'confirm-deletion.html'] as $path) {
                $pages[$path] = self::html('fr');
                $pages['en/'.$path] = self::html('en');
            }
        }

        $root = sys_get_temp_dir().'/ayelo-site-'.bin2hex(random_bytes(6));
        mkdir($root.'/tools', 0777, true);
        $groups = [];
        foreach ($slots as $key => $slot) {
            $groups[$slot['group']][] = $key;
        }
        file_put_contents($root.'/tools/legal-slots.json', json_encode([
            'version' => 1,
            'pages' => array_keys($pages),
            'groups' => $groups,
            'slots' => $slots,
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        foreach ($pages as $path => $html) {
            @mkdir(dirname($root.'/'.$path), 0777, true);
            file_put_contents($root.'/'.$path, $html);
        }
        config(['site.web_root' => $root]);

        return $root;
    }
}
