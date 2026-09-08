<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WeatherForecast extends Model
{
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

    public function volcano()
    {
        return $this->belongsTo(Volcano::class);
    }
}