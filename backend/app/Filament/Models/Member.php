<?php

namespace App\Filament\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/** Table `users` vue par le personnel. Le hash du mot de passe n'est jamais chargé dans l'interface. */
class Member extends AdminRecord
{
    protected $table = 'users';

    protected $hidden = ['password'];

    protected function casts(): array
    {
        return ['last_seen_at' => 'datetime', 'created_at' => 'datetime', 'email_verified_at' => 'datetime', 'birthdate' => 'date'];
    }

    public function profile(): HasOne
    {
        return $this->hasOne(MemberProfile::class, 'user_id');
    }

    public function sanctions(): HasMany
    {
        return $this->hasMany(Sanction::class, 'user_id');
    }

    public function riskEvents(): HasMany
    {
        return $this->hasMany(RiskEvent::class, 'user_id');
    }

    public function creditEntries(): HasMany
    {
        return $this->hasMany(CreditEntry::class, 'user_id');
    }
}
