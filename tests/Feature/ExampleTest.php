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
