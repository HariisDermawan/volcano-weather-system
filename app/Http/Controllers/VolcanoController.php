<?php

namespace App\Http\Controllers;

use App\Models\Volcano;

class VolcanoController extends Controller
{
    public function index()
    {
        $volcanoes = Volcano::query()
            ->orderBy('name')
            ->get([
                'id',
                'name',
                'code',
                'latitude',
                'longitude',
                'elevation',
                'status',
            ]);

        return response()->json($volcanoes);
    }
}