<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeatherCurrent extends Model
{
    protected $fillable = [
        'volcano_id',
        'source',
        'observed_at',
        'temperature_c',
        'apparent_temperature_c',
        'humidity',
        'pressure_msl',
        'wind_speed_kmh',
        'wind_direction_deg',
        'wind_direction_cardinal',
        'wind_gust_kmh',
    ];

    protected $casts = [
        'observed_at' => 'datetime',
        'temperature_c' => 'float',
        'apparent_temperature_c' => 'float',
        'humidity' => 'float',
        'pressure_msl' => 'float',
        'wind_speed_kmh' => 'float',
        'wind_direction_deg' => 'float',
        'wind_gust_kmh' => 'float',
    ];

    /**
     * @return BelongsTo<Volcano, $this>
     */
    public function volcano(): BelongsTo
    {
        return $this->belongsTo(Volcano::class);
    }
}
