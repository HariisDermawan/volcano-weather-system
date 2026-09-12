<?php

namespace Database\Factories;

use App\Models\Volcano;
use App\Models\WeatherForecast;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WeatherForecast>
 */
class WeatherForecastFactory extends Factory
{
    protected $model = WeatherForecast::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'volcano_id' => Volcano::factory(),
            'source' => 'BMKG',
            'forecast_at' => $this->faker->dateTimeBetween('-1 hour', '+48 hours'),
            'temperature' => $this->faker->optional()->randomFloat(1, 15, 35),
            'humidity' => $this->faker->optional()->randomFloat(1, 40, 100),
            'wind_speed' => $this->faker->optional()->randomFloat(1, 0, 40),
            'wind_direction' => $this->faker->optional()->randomElement([
                'N',
                'NE',
                'E',
                'SE',
                'S',
                'SW',
                'W',
                'NW',
            ]),
            'weather' => $this->faker->optional()->randomElement([
                'Cerah',
                'Berawan',
                'Hujan Ringan',
                'Hujan Lebat',
            ]),
        ];
    }
}
