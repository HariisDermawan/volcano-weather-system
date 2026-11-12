<?php

test('root redirects to monitoring', function () {
    $this->get('/')
        ->assertRedirect(route('monitoring'))
        ->assertStatus(301);
});

test('monitoring page renders', function () {
    $this->get(route('monitoring'))
        ->assertOk();
});

test('monitoring page exposes social preview metadata', function () {
    $this->get(route('monitoring'))
        ->assertOk()
        ->assertSee('property="og:image"', false)
        ->assertSee('logo/og-image.png', false)
        ->assertSee('property="og:title"', false)
        ->assertSee('name="twitter:image"', false)
        ->assertSee('name="twitter:card"', false)
        ->assertSee('summary_large_image', false);
});
