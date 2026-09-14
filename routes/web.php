<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/monitoring', 301);

Route::get('/robots.txt', function () {
    $sitemap = rtrim(config('app.url'), '/').'/sitemap.xml';
    $content = "User-agent: *\nAllow: /\nSitemap: {$sitemap}\n";

    return response($content, 200, [
        'Content-Type' => 'text/plain',
    ]);
});

Route::get('/sitemap.xml', function () {
    $base = rtrim(config('app.url'), '/');
    $today = now()->toDateString();
    $xml = <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{$base}/monitoring</loc>
    <lastmod>{$today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
XML;

    return response($xml, 200, [
        'Content-Type' => 'application/xml',
    ]);
});

Route::get('/monitoring', function () {
    return Inertia::render('Monitoring');
})->name('monitoring');
