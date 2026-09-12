<?php

namespace Database\Factories;

use App\Models\Volcano;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Volcano>
 */
class VolcanoFactory extends Factory
{
    protected $model = Volcano::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => 'Gunung '.$this->faker->word(),
            'code' => mb_strtoupper($this->faker->lexify('???')),
            'latitude' => $this->faker->latitude(),
            'longitude' => $this->faker->longitude(),
            'elevation' => $this->faker->optional()->numberBetween(300, 4000),
            'status' => 'Level I - Normal',
        ];
    }
}
