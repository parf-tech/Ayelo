<?php

namespace App\Filament\Support;

use Filament\Infolists\Components\TextEntry;
use Filament\Tables\Columns\TextColumn;
use Illuminate\Support\Facades\Lang;

/**
 * Libellés traduits et couleurs des états affichés dans le back-office (jamais de valeur technique brute : « open », « active »).
 * Les groupes d'états sont sous `status.*` dans `lang/{fr,en}/admin.php` ; `audit`, `media_kind`, `credit_type` et `risk_signal`
 * sont des groupes à part. Une valeur inconnue reste affichée telle quelle (aucune perte d'information).
 */
final class Labels
{
    private const TOP_LEVEL = ['audit', 'media_kind', 'credit_type', 'risk_signal', 'priority', 'context', 'reject_label'];

    private const COLORS = [
        'report' => ['open' => 'warning', 'reviewed' => 'info', 'actioned' => 'success', 'dismissed' => 'gray'],
        'account' => ['active' => 'success', 'suspended' => 'warning', 'banned' => 'danger', 'deleting' => 'gray', 'deleted' => 'gray'],
        'verification' => ['pending' => 'warning', 'approved' => 'success', 'rejected' => 'danger'],
        'ticket' => ['open' => 'warning', 'pending' => 'info', 'closed' => 'gray'],
        'appeal' => ['open' => 'warning', 'accepted' => 'success', 'rejected' => 'danger'],
        'profile' => ['none' => 'gray', 'pending' => 'warning', 'verified' => 'success', 'rejected' => 'danger'],
        'sanction' => ['warning' => 'warning', 'suspension' => 'warning', 'ban' => 'danger'],
        'outcome' => ['warning' => 'warning', 'suspension' => 'warning', 'ban' => 'danger', 'none' => 'gray'],
        'priority' => ['0' => 'gray', '1' => 'warning', '2' => 'danger'],
        'audit' => [
            'user.banned' => 'danger', 'media.rejected' => 'danger', 'staff.login_failed' => 'danger', 'admin.cap_exceeded' => 'danger',
            'report.ban' => 'danger', 'media.preview' => 'info', 'verification.selfie_viewed' => 'info',
        ],
    ];

    public static function text(string $group, mixed $state): string
    {
        $value = $state instanceof \BackedEnum ? (string) $state->value : (string) $state;
        $key = 'admin.'.(in_array($group, self::TOP_LEVEL, true) ? $group : 'status.'.$group).'.'.$value;

        return $value !== '' && Lang::has($key, StaffLocale::resolve()) ? Staff::t($key) : $value;
    }

    public static function color(string $group, mixed $state): string
    {
        return self::COLORS[$group][(string) $state] ?? 'gray';
    }

    /**
     * @param  list<string>  $keys
     * @return array<string, string>
     */
    public static function options(string $group, array $keys): array
    {
        return collect($keys)->mapWithKeys(fn (string $key): array => [$key => self::text($group, $key)])->all();
    }

    public static function badge(TextColumn | TextEntry $component, string $group): TextColumn | TextEntry
    {
        return $component->badge()
            ->formatStateUsing(fn ($state): string => self::text($group, $state))
            ->color(fn ($state): string => self::color($group, $state));
    }
}
