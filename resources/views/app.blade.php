<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0a0f1c">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">

        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
        <link rel="icon" href="/favicon.ico" type="image/x-icon">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Volcano Watch') }}</title>
            <meta name="description" content="Monitoring real-time gunung berapi Indonesia: status aktivitas Awas, Siaga, Waspada, Normal; prakiraan cuaca, arah angin, sebaran abu vulkanik, laporan erupsi dan gempa dari sumber resmi PVMBG, BMKG, dan VAAC Darwin.">
            <meta name="robots" content="index, follow">

            <link rel="preconnect" href="https://server.arcgisonline.com">
            <link rel="preconnect" href="https://embed.windy.com" crossorigin>

            <link rel="canonical" href="{{ url()->current() }}">
            <meta property="og:type" content="website">
            <meta property="og:title" content="{{ config('app.name', 'Volcano Watch') }} - Monitoring Gunung Berapi Indonesia">
            <meta property="og:description" content="Pantau status aktivitas gunung berapi Indonesia secara real-time: erupsi, gempa, prakiraan cuaca, dan sebaran abu vulkanik.">
            <meta property="og:url" content="{{ url()->current() }}">
            <meta property="og:site_name" content="{{ config('app.name', 'Volcano Watch') }}">
            <meta property="og:locale" content="id_ID">
            <meta property="og:image" content="{{ asset('logo/sig.png') }}">
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="{{ config('app.name', 'Volcano Watch') }} - Monitoring Gunung Berapi Indonesia">
            <meta name="twitter:description" content="Pantau status aktivitas gunung berapi Indonesia secara real-time: erupsi, gempa, prakiraan cuaca, dan sebaran abu vulkanik.">
            <meta name="twitter:image" content="{{ asset('logo/sig.png') }}">
            <script type="application/ld+json">
                {
                    "@@context": "https://schema.org",
                    "@@type": "WebSite",
                    "name": "Volcano Watch",
                    "url": "{{ url('/') }}",
                    "description": "Monitoring aktivitas gunung berapi Indonesia secara real-time.",
                    "inLanguage": "id-ID"
                }
            </script>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <x-inertia::app />
    </body>
</html>
