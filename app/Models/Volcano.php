<?php

namespace App\Models;

use Database\Factories\VolcanoFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Volcano extends Model
{
    /** @use HasFactory<VolcanoFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'latitude',
        'longitude',
        'elevation',
        'status',
    ];
}
