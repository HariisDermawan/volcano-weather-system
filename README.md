<<<<<<< HEAD
![Volcano Watch](https://raw.githubusercontent.com/HariisDermawan/volcano-weather-system/main/public/gambar/image.png)

Volcano Watch
=======
# Volcano Watch
>>>>>>> a56385f (feat: add new image asset for volcano monitoring)

Sistem pemantauan **gunung api & cuaca** interaktif untuk Indonesia. Menampilkan status aktivitas gunung api (PVMBG/MAGMA), informasi letusan, advisory abu vulkanik VAAC Darwin (BOM), prakiraan & prediksi sebaran abu, gempa bumi terkini (BMKG), gerakan tanah, serta prakiraan cuaca (BMKG & Open-Meteo) — semuanya divisualisasikan di atas peta Leaflet secara real-time.

## Fitur Utama

- **Dashboard Monitoring** — peta interaktif Leaflet full-screen dengan penanda gunung api, panel status, dan legenda.
- **Status Gunung Api** — level aktivitas PVMBG (MAGMA) + peringatan GDACS.
- **Letusan Gunung Api** — riwayat letusan terbaru dari PVMBG/MAGMA.
- **Advisory Abu Vulkanik (VAAC Darwin)** — parsing otomatis advisori BOM (UTC→WIB, FL→meter), tampil sebagai panel dan layer sebaran abu di peta.
- **Prediksi Sebaran Abu** — arah, kecepatan, tingkat risiko (low/medium/high/extreme), dan confidence per gunung.
- **Timeline Sebaran** — animasi play/pause jalur penyebaran abu dari waktu ke waktu.
- **"Kota Saya" (Plume Check)** — cek apakah lokasi pengguna berada di dalam sebaran abu aktif beserta jarak ke tepi abu.
- **Gempa Terkini & Gerakan Tanah** — informasi real-time dari BMKG / PVMBG.
- **Prakiraan Cuaca** — per 3 jam untuk lokasi gunung dari BMKG + data cuaca terkini Open-Meteo.
- **Peta Angin / Windy** — layer konsentrasi SO₂ (CAMS) yang terkait dengan sebaran asap gunung.

## Arsitektur

```
┌─────────────────────────────┐      ┌──────────────────────────────┐
│  Laravel (PHP 8.3)          │      │  Python Service (FastAPI)    │
│  Inertia + React 19 SPA     │      │  Collectors + Scheduler      │
│  Leaflet map monitoring     │      │  → MySQL db_weather_sistem   │
├─────────────────────────────┤      ├──────────────────────────────┤
│  Live fetch + cache ke      │◄────►│  Polling tiap 10 menit:      │
│  API eksternal (PVMBG,      │      │  • aktivitas gunung          │
│  BOM, BMKG, GDACS, dll)     │      │  • sinkronisasi advisory VAAC│
│  fallback ke database       │      │  • cuaca BMKG               │
└─────────────────────────────┘      │  • prediksi sebaran abu      │
                                     └──────────────────────────────┘
```

- **Laravel app**: SPA Inertia v3 + React 19. Data live di-fetch via PHP service dengan cache (dengan fallback ke database bila API eksternal down).
- **Python service** (`python-service/`): FastAPI + SQLAlchemy yang terhubung ke MySQL `db_weather_sistem` (terpisah dari SQLite dev DB Laravel). Scheduler berjalan setiap 10 menit untuk mengumpulkan data dari berbagai sumber dan men-generate prediksi sebaran abu.

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| Backend | PHP 8.3, Laravel 13, Laravel Sanctum |
| Frontend | Inertia v3, React 19, TypeScript 5.7, Vite 8 (vite-plus), Tailwind CSS 4, Leaflet 1.9.4 / react-leaflet 5, lucide-react, React Compiler |
| Python Service | FastAPI, SQLAlchemy 2, PyMySQL, APScheduler, requests |
| Database | MySQL (`db_weather_sistem` untuk python service), SQLite (dev DB Laravel) |
| Kualitas | Pest v4, PHPStan level 7, Pint (preset `laravel`), TypeScript strict |
| Networking | GitHub Actions (PHP 8.3 + Node 22, `composer ci:check`) |

## Prasyarat

- PHP ≥ 8.3 dengan ekstensi yang dibutuhkan Laravel
- Node.js ≥ 22 & npm
- Composer
- MySQL (untuk python service)
- Python 3.10+ (untuk python service)

> **Catatan**: File `.npmrc` menonaktifkan `ignore-scripts=true` — skrip postinstall npm tidak berjalan.

## Instalasi

### 1. Aplikasi Laravel

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --force
npm install
npm run build
```

Atau gunakan script otomatis:

```bash
composer setup
```

### 2. Menjalankan Development

```bash
composer dev          # menjalankan Vite + queue + scheduler dalam satu proses
```

Alternatif manual:

```bash
php artisan serve &       # terminal 1
npm run dev               # terminal 2
```

### 3. Python Service

```bash
cd python-service
python -m venv venv
venv\Scripts\activate       # Windows (Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
```

Siapkan `.env` di dalam `python-service/`:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=db_weather_sistem
MYSQL_USERNAME=root
MYSQL_PASSWORD=
```

Jalankan collector/scheduler:

```bash
python -m app.scheduler
```

Atau jalankan API FastAPI-nya:

```bash
uvicorn app.main:app --reload
```

> **Catatan**: `beautifulsoup4` dipakai oleh beberapa collector tapi belum tercantum di `requirements.txt` — tambahkan bila collector gagal: `pip install beautifulsoup4`.

## Environment

`.env` utama menggunakan **MySQL** (bukan pengaturan default skeleton):

```env
APP_NAME=Volcano Watch
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=db_weather_sistem
DB_USERNAME=root
DB_PASSWORD=
```

## API Endpoint (Laravel)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/volcanoes` | Daftar gunung api dengan flag `ash_active`, `status`, `erupting` secara live |
| GET | `/api/monitoring/volcano/{volcano}` | Payload lengkap per gunung (aktivitas, letusan, GDACS, cuaca, advisori & prediksi abu) |
| GET | `/api/gempa` | Gempa terkini BMKG (cache 90 detik) |
| GET | `/api/gerakan-tanah` | Kejadian gerakan tanah PVMBG (cache 180 detik) |
| GET | `/api/kota?lat=&lon=` | Cek apakah lokasi di dalam sebaran abu aktif (point-in-polygon) |

### Endpoint Web

| Method | Path | Deskripsi |
|---|---|---|
| GET | `/` → `/monitoring` | Redirect permanen ke dashboard |
| GET | `/monitoring` | Halaman dashboard SPA (Inertia) |
| GET | `/robots.txt` | Robots + sitemap reference |
| GET | `/sitemap.xml` | Sitemap |

## Sumber Data

| Data | Sumber |
|---|---|
| Level aktivitas & letusan gunung | PVMBG / MAGMA (via `MagmaService`, cache 3 menit) |
| Advisory abu vulkanik | VAAC Darwin — BOM (via `VaacDarwinService`, cache 2 menit) |
| Peringatan / alert | GDACS (cache 10 menit) |
| Gempa terkini | BMKG (`autogempa.json`, fallback Nuxt SSR, `gempaterkini.json`; cache 90 detik) |
| Gerakan tanah | PVMBG tanggapan-kejadian (cache 180 detik) |
| Prakiraan cuaca per gunung | BMKG (via python service) |
| Cuaca terkini | Open-Meteo (`WeatherCurrent`, unik per volcano) |
| Konsentrasi SO₂ | Windy / CAMS layer |
<<<<<<< HEAD
=======

## Struktur Proyek

```
app/
├── Http/Controllers/        # MonitoringController, VolcanoController, GeoHazardController, CityMonitoringController
├── Models/                  # Volcano, Eruption, AshAdvisory, AshPrediction, WeatherForecast, WeatherObservation, WindObservation, WeatherCurrent, User
└── Services/                # VaacDarwinService, MagmaService, GdacsService
database/migrations/         # 18 migrasi (termasuk merge_duplicate_volcanoes, unique volcano/issued_at)
resources/js/
├── pages/Monitoring.tsx     # Dashboard utama (SPA, fetch client-side)
├── components/VolcanoMap.tsx # Peta Leaflet + marker & layer abu
└── components/WindyMap.tsx  # Layer Windy SO₂
python-service/
├── app/
│   ├── main.py              # FastAPI entry (port 8000)
│   ├── scheduler.py         # run_all_jobs() tiap 10 menit
│   ├── collectors/          # vaac, activity, volcano, weather, openmeteo, wind
│   ├── jobs/                # production jobs + helper scripts
│   └── models/              # SQLAlchemy models (ash_model: simulasi plume)
└── wilayah-adm4/            # pemetaan admin region BMKG (Rust + SQLite)
routes/
├── web.php                  # /monitoring (Inertia), redirect /, robots, sitemap
└── api.php                  # 6 API endpoint
```

## Model Database (8 tabel utama)

- **Volcano** — nama, kode, koordinat, elevasi, status
- **Eruption** — riwayat letusan per gunung
- **AshAdvisory** — unik `(volcano_id, issued_at)`, JSON `geometry` & `fcst_geometries`
- **AshPrediction** — risiko sebaran abu (`low/medium/high/extreme`) + `forecast_at`
- **WeatherForecast** — unik `(volcano_id, forecast_at)`, prakiraan BMKG
- **WeatherObservation** / **WindObservation** — observasi cuaca & angin
- **WeatherCurrent** — cuaca terkini Open-Meteo (unik per volcano)
- **Tabel join** `volcano_weather_sources` — pemetaan volcano ↔ BMKG adm4

## Quality & CI

```bash
composer lint            # formatter Pint (fix)
composer lint:check      # Pint dry-run
composer types:check     # PHPStan level 7
composer test            # lint → types → pest (semua)
npm run check            # vite-plus lint JS/TS
npm run types:check      # tsc --noEmit
composer ci:check        # mirip pipeline CI

php artisan test --compact                        # semua test
php artisan test --compact --filter=testName      # per nama
```

CI tunggal (`.github/workflows/tests.yml`) berjalan pada push ke `main` dan semua PR: checkout → PHP 8.3 → Node 22 → `composer setup` → `composer ci:check`.

## FAQ & Troubleshooting

**Vite manifest error saat akses halaman?**
Bangun aset dulu: `npm run build`, atau jalankan `composer dev`.

**Aplikasi tidak terhubung ke MySQL?**
Pastikan `python-service/.env` berisi kredensial MySQL yang sesuai, dan service scheduler berjalan.

**Collector gagal karena `bs4`?**
Instal dependensi yang belum tercantum: `pip install beautifulsoup4` lalu tambahkan ke `requirements.txt`.

## Lisensi

MIT
>>>>>>> a56385f (feat: add new image asset for volcano monitoring)
