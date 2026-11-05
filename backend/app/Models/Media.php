<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Media extends Model
{
    use HasUuids;

    protected $table = 'media';

    protected $fillable = ['user_id', 'kind', 'status', 'storage_key', 'mime_type', 'size_bytes', 'duration_seconds', 'position'];
}
