<?php

namespace Database\Factories;

use App\Models\Eruption;
use App\Models\Volcano;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Eruption>
 */
class EruptionFactory extends Factory
{
    protected $model = Eruption::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'volcano_id' => Volcano::factory(),
            'occurred_at' => $this->faker->dateTimeBetween('-30 days'),
            'ash_height' => $this->faker->optional()->randomFloat(0, 500, 8000),
            'activity_level' => $this->faker->randomElement([
                'Level I - Normal',
                'Level II - Waspada',
                'Level III - Siaga',
                'Level IV - Awas',
            ]),
            'description' => $this->faker->sentence(8),
        ];
    }
}
