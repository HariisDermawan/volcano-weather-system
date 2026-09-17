<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Database Guard
|--------------------------------------------------------------------------
|
| A cached bootstrap/cache/config.php bakes in the real environment, so the
| sqlite :memory: overrides in phpunit.xml are ignored and RefreshDatabase
| runs migrate:fresh against the MySQL dev database. Abort the suite before
| any test (and therefore any migration) runs when that happens.
|
*/

$cachedConfigPath = __DIR__.'/../bootstrap/cache/config.php';

if (is_file($cachedConfigPath)) {
    $cachedConfig = require $cachedConfigPath;

    $defaultConnection = $cachedConfig['database']['default'] ?? null;

    if ($defaultConnection !== 'sqlite') {
        fwrite(
            STDERR,
            PHP_EOL.'DANGER: cached config selects the "'
            .$defaultConnection.'" connection. Run `php artisan config:clear` '
            .'before testing or the dev database will be wiped.'.PHP_EOL
        );

        exit(1);
    }
}

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Expectations
|--------------------------------------------------------------------------
|
| When you're writing tests, you often need to check that values meet certain conditions. The
| "expect()" function gives you access to a set of "expectations" methods that you can use
| to assert different things. Of course, you may extend the Expectation API at any time.
|
*/

expect()->extend('toBeOne', function () {
    return $this->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Functions
|--------------------------------------------------------------------------
|
| While Pest is very powerful out-of-the-box, you may have some testing code specific to your
| project that you don't want to repeat in every file. Here you can also expose helpers as
| global functions to help you to reduce the number of lines of code in your test files.
|
*/

function something()
{
    // ..
}
