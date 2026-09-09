"""Pemetaan alias nama gunung antara sumber data dan database.

Gunung yang sama kadang ditulis berbeda di halaman MAGMA/PVMBG
dan di database lokal. Normalisasi di sini memastikan record
tetap cocok satu sama lain.
"""


VOLCANO_NAME_ALIASES = {
    "anak krakatau": "Gunung Anak Krakatau",
    "gunung anak krakatau": "Gunung Anak Krakatau",
    "krakatau": "Gunung Anak Krakatau",
    "gunung krakatau": "Gunung Anak Krakatau",
    "kelud": "Gunung Kelud",
    "merapi": "Gunung Merapi",
    "semeru": "Gunung Semeru",
    "bromo": "Gunung Bromo",
    "agung": "Gunung Agung",
    "batur": "Gunung Batur",
    "rinjani": "Gunung Rinjani",
    "soputan": "Gunung Soputan",
    "karangetang": "Gunung Karangetang",
    "sinabung": "Gunung Sinabung",
    "raung": "Gunung Raung",
    "ijen": "Gunung Ijen",
    "merapi jawa tengah": "Gunung Merapi",
    "merapi diy": "Gunung Merapi",
    "slamet": "Gunung Slamet",
    "galunggung": "Gunung Galunggung",
    "papandayan": "Gunung Papandayan",
    "guntur": "Gunung Guntur",
    "ciremai": "Gunung Ciremai",
    "ceremai": "Gunung Ciremai",
    "tangkuban parahu": "Gunung Tangkuban Parahu",
    "tangkubanparahu": "Gunung Tangkuban Parahu",
    "salak": "Gunung Salak",
    "gede": "Gunung Gede",
    "pancar": "Gunung Pancar",
    "kelimutu": "Gunung Kelimutu",
    "ewon": "Gunung Ewon",
    "lewotobi": "Gunung Lewotobi",
    "lewotolo": "Gunung Lewotolo",
    "lewotolok": "Ili Lewotolok",
    "leroboleng": "Gunung Leroboleng",
    "batutara": "Gunung Batutara",
    "ile werung": "Gunung Ile Werung",
    "ile mandiri": "Gunung Ile Mandiri",
    "iya": "Gunung Iya",
    "sumbing": "Gunung Sumbing",
    "sindoro": "Gunung Sindoro",
    "dieng": "Gunung Dieng",
    "kaba": "Gunung Kaba",
    "dempo": "Gunung Dempo",
    "kerinci": "Gunung Kerinci",
    "talang": "Gunung Talang",
    "marapi": "Gunung Marapi",
    "singgalang": "Gunung Singgalang",
    "tandikat": "Gunung Tandikat",
    "sibayak": "Gunung Sibayak",
    "sibualbuali": "Gunung Sibualbuali",
    "lubukraya": "Gunung Lubuk Raya",
    "sorik merapi": "Gunung Sorik Merapi",
    "talamau": "Gunung Talamau",
    "gadang": "Gunung Gadang",
    "sago": "Gunung Sago",
    "pasaman": "Gunung Pasaman",
    "tandai": "Gunung Tandai",
}


def normalize_volcano_name(name):
    """Samakan penulisan nama gunung antar sumber."""

    if not name:
        return name

    clean = " ".join(name.split()).strip()

    return VOLCANO_NAME_ALIASES.get(
        clean.lower(),
        clean,
    )


def volcano_match_candidates(name):
    """Urutan nama kandidat untuk dicocokkan ke `volcanoes.name`.

    Database lokal punya variasi penulisan (misal `Ibu` vs
    `Gunung Ibu`, `Ili Lewotolok` vs `Lewotolok`). Fungsi ini
    mengembalikan varian nama yang layak dicoba, dari yang
    paling spesifik sampai yang paling longgar.
    """

    clean = " ".join(name.split()).strip()
    normalized = normalize_volcano_name(name)

    candidates = []

    def push(value):
        value = " ".join(value.split()).strip()

        if value and value.lower() not in {
            c.lower() for c in candidates
        }:
            candidates.append(value)

    push(normalized)
    push(clean)

    if not clean.lower().startswith("gunung "):
        push(f"Gunung {clean}")

    if clean.lower().startswith("gunung "):
        base = " ".join(clean.split()[1:])
        push(base)

    return candidates
