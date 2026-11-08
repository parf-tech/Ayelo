<?php

namespace App\Providers;

use App\Filament\Commands\SanctionsExpireCommand;
use App\Filament\Commands\StaffCreateCommand;
use App\Filament\Commands\StaffResetTwoFactorCommand;
use App\Filament\Models;
use App\Filament\Pages\Auth\EditStaffProfile;
use App\Filament\Pages\Auth\StaffLogin;
use App\Filament\Policies;
use App\Filament\Resources;
use App\Filament\Support\StaffLocale;
use App\Filament\Widgets\AdminStatsWidget;
use App\Services\Admin\StaffAuthAudit;
use Filament\Auth\MultiFactor\App\AppAuthentication;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/**
 * Panneau d'administration (Filament) sur /admin, séparé de l'API : garde « staff », 2FA obligatoire,
 * droits par rôle (App\Services\Admin\Permissions). En production : sous-domaine dédié et accès réseau restreint
 * (docs/11), configurés côté infrastructure.
 */
class AdminPanelProvider extends PanelProvider
{
    public function boot(): void
    {
        self::warnIfUnbound();

        // L'API est sans état (SESSION_DRIVER=array dans .env.example) ; le panneau a besoin d'une vraie session.
        if (config('session.driver') === 'array' && ! $this->app->environment('testing')) {
            config(['session.driver' => 'file']);
        }

        foreach ([
            Models\MediaItem::class => Policies\MediaItemPolicy::class,
            Models\Report::class => Policies\ReportPolicy::class,
            Models\Appeal::class => Policies\AppealPolicy::class,
            Models\VerificationRequest::class => Policies\VerificationRequestPolicy::class,
            Models\Member::class => Policies\MemberPolicy::class,
            Models\SupportTicket::class => Policies\SupportTicketPolicy::class,
            Models\AuditEntry::class => Policies\AuditEntryPolicy::class,
            Models\Sanction::class => Policies\SanctionPolicy::class,
            Models\RiskEvent::class => Policies\SanctionPolicy::class,
            Models\CreditEntry::class => Policies\CreditEntryPolicy::class,
        ] as $model => $policy) {
            Gate::policy($model, $policy);
        }

        Event::subscribe(StaffAuthAudit::class);

        if ($this->app->runningInConsole()) {
            $this->commands([StaffCreateCommand::class, StaffResetTwoFactorCommand::class, SanctionsExpireCommand::class]);
        }
    }

    /**
     * En production sans ADMIN_DOMAIN, le panneau serait servi sur le domaine de l'API (revue N-01). On journalise en
     * critique plutôt que de lever une exception : un démarrage interrompu (build d'image, config:cache) est pire ici.
     */
    public static function warnIfUnbound(): void
    {
        if (app()->isProduction() && self::adminDomain() === null) {
            Log::critical('ADMIN_DOMAIN est vide en production : le panneau d administration est servi sur tous les domaines.');
        }
    }

    /** Domaine dédié du panneau, ou null (local, tests) : alors servi sur tous les domaines. */
    public static function adminDomain(): ?string
    {
        return config('app.admin_domain') ?: null;
    }

    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            // En production le panneau n'est servi que sur ADMIN_DOMAIN (revue N-01) ; vide en local et en test.
            ->domain(self::adminDomain())
            ->path('admin')
            ->authGuard('staff')
            ->login(StaffLogin::class)
            ->profile(EditStaffProfile::class, isSimple: false)
            ->multiFactorAuthentication([AppAuthentication::make()->recoverable()], isRequired: true)
            ->brandName('Ayelo · Administration')
            ->colors(['primary' => Color::Indigo])
            ->globalSearch(false)
            ->resources([
                Resources\MediaItemResource::class,
                Resources\ReportResource::class,
                Resources\AppealResource::class,
                Resources\VerificationRequestResource::class,
                Resources\MemberResource::class,
                Resources\SupportTicketResource::class,
                Resources\AuditEntryResource::class,
            ])
            ->pages([Dashboard::class])
            ->widgets([AdminStatsWidget::class])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                VerifyCsrfToken::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->middleware([StaffLocale::class], isPersistent: true)
            ->authMiddleware([Authenticate::class]);
    }
}
