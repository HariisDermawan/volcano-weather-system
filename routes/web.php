<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::inertia('/', 'welcome')->name('home');
Route::get('/monitoring', function () {
    return Inertia::render('Monitoring');
})->name('monitoring');
