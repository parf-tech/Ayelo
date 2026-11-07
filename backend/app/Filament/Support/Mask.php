<?php

namespace App\Filament\Support;

/** Masquage d'identifiants personnels dans les listes (minimisation) : l'e-mail complet n'est montré que sur la fiche, au rôle `users.view`. */
final class Mask
{
    /** `awa.diallo@example.com` devient `a***@e***.com` ; une valeur mal formée devient `***`. */
    public static function email(?string $email): ?string
    {
        if ($email === null || $email === '') {
            return null;
        }
        $at = strrpos($email, '@');
        if ($at === false || $at === 0 || $at === strlen($email) - 1) {
            return '***';
        }
        $local = substr($email, 0, $at);
        $domain = substr($email, $at + 1);
        $dot = strrpos($domain, '.');
        $name = $dot === false ? $domain : substr($domain, 0, $dot);
        $tld = $dot === false ? '' : substr($domain, $dot);

        return mb_substr($local, 0, 1).'***@'.mb_substr($name, 0, 1).'***'.$tld;
    }
}
