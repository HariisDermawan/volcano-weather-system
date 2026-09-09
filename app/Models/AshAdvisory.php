<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AshAdvisory extends Model
{
    protected $fillable = [
        'volcano_id',
        'source',
        'advisory_nr',
        'issued_at',
        'observed_at',
        'next_advisory_at',
        'volcano_code',
        'volcano_name',
        'ash_detected',
        'altitude_ft',
        'ash_height_m',
        'movement',
        'speed_kts',
        'geometry',
        'fcst_geometries',
        'eruption_detail',
        'remarks',
        'raw_text',
    ];

    protected $casts = [
        'issued_at' => 'datetime',
        'observed_at' => 'datetime',
        'next_advisory_at' => 'datetime',
        'ash_detected' => 'boolean',
        'altitude_ft' => 'integer',
        'ash_height_m' => 'float',
        'speed_kts' => 'integer',
        'geometry' => 'array',
        'fcst_geometries' => 'array',
    ];

    /**
     * @return BelongsTo<Volcano, $this>
     */
    public function volcano(): BelongsTo
    {
        return $this->belongsTo(Volcano::class);
    }
}
