<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Profile extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'display_name', 'gender', 'origin_country', 'residence_country', 'city', 'bio', 'intent',
        'is_visible', 'hide_distance', 'hide_last_seen',
    ];

    protected function casts(): array
    {
        return [
            'is_visible' => 'boolean',
            'hide_distance' => 'boolean',
            'hide_last_seen' => 'boolean',
            'residence_changed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
