<?php

namespace App\Models;

use Database\Factories\EruptionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Eruption extends Model
{
    /** @use HasFactory<EruptionFactory> */
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

    /**
     * @return BelongsTo<Volcano, $this>
     */
    public function volcano(): BelongsTo
    {
        return $this->belongsTo(Volcano::class);
    }
}
