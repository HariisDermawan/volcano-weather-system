<?php

use App\Http\Controllers\MonitoringController;
use App\Http\Controllers\VolcanoController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


Route::get('/monitoring/volcano/{volcano}', [MonitoringController::class, 'show']);
Route::get('/volcanoes', [VolcanoController::class, 'index']);