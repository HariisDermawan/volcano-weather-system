<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AshPrediction extends Model
{
    /**
     * @var array<string, string>
     */
    protected $casts = [
        'generated_at' => 'datetime',
        'forecast_at' => 'datetime',
    ];
}
