<?php

namespace App\Models;

use Database\Factories\WeatherForecastFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeatherForecast extends Model
{
    /** @use HasFactory<WeatherForecastFactory> */
    use HasFactory;

    protected $fillable = [
        'volcano_id',
        'source',
        'forecast_at',
        'temperature',
        'humidity',
        'wind_speed',
        'wind_direction',
        'weather',
    ];

    protected $casts = [
        'forecast_at' => 'datetime',
        'temperature' => 'float',
        'humidity' => 'float',
        'wind_speed' => 'float',
    ];

    /**
     * @return BelongsTo<Volcano, $this>
     */
    public function volcano(): BelongsTo
    {
        return $this->belongsTo(Volcano::class);
    }
}
