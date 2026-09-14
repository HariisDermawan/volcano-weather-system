<?php

use Illuminate\Support\Facades\Http;

it('mengembalikan cuaca BMKG pada /api/kota', function () {
    Http::fake([
        'api.bmkg.go.id/*' => Http::response([
            'lokasi' => [
                'provinsi' => 'DKI Jakarta',
                'kotkab' => 'Kota Adm. Jakarta Pusat',
                'kecamatan' => 'Kemayoran',
                'desa' => 'Kemayoran',
            ],
            'data' => [
                [
                    'cuaca' => [
                        [
                            [
                                'local_datetime' => now('Asia/Jakarta')->format('Y-m-d H:i:s'),
                                't' => 28,
                                'hu' => 66,
                                'ws' => 2.9,
                                'wd_deg' => 129,
                                'wd' => 'E',
                                'vs' => 12523,
                                'vs_text' => '> 10 km',
                                'weather' => 1,
                                'weather_desc' => 'Cerah',
                            ],
                        ],
                    ],
                ],
            ],
        ], 200),
        '*' => Http::response([], 200),
    ]);

    $response = $this->getJson('/api/kota?lat=-6.1647&lon=106.8454');

    $response->assertOk()
        ->assertJsonPath('weather.source', 'BMKG')
        ->assertJsonPath('weather.weather_desc', 'Cerah')
        ->assertJsonPath('weather.weather_code', 1)
        ->assertJsonPath('weather.temperature', 28)
        ->assertJsonPath('weather.humidity', 66)
        ->assertJsonPath('weather.wind_direction_cardinal', 'E')
        ->assertJsonPath('weather.visibility_text', '> 10 km');

    expect($response->json('weather.adm4'))->not->toBeNull();
});

it('mengembalikan weather null saat BMKG gagal atau kosong', function () {
    Http::fake([
        'api.bmkg.go.id/*' => Http::response([
            'lokasi' => [
                'desa' => 'Kemayoran',
            ],
            'data' => [],
        ], 200),
        '*' => Http::response([], 200),
    ]);

    $response = $this->getJson('/api/kota?lat=-6.1647&lon=106.8454');

    $response->assertOk()
        ->assertJsonPath('weather', null);
});
