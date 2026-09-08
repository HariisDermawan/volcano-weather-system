<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Eruption extends Model
{
    use HasFactory;

    protected $fillable = [
        'volcano_id',
        'occurred_at',
        'ash_height',
        'activity_level',
        'description',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'ash_height' => 'float',
    ];

    public function volcano()
    {
        return $this->belongsTo(Volcano::class);
    }
}