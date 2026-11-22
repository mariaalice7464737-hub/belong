"""Categorias do Explore e o vocabulário que liga palavras da busca a cada uma.

As palavras ficam sem acento e em minúsculas (o parser normaliza a busca do mesmo jeito).
`places_query` é o texto enviado ao Google Places quando a busca não traz uma atividade específica.
`tm_segment` é o segmento do Ticketmaster usado como filtro (quando faz sentido).
"""
from __future__ import annotations

CATEGORIES: list[dict] = [
    {
        "id": "music-night", "label": "Música e noite", "label_en": "Music & nightlife", "icon": "music",
        "keywords": ["musica", "music", "show", "shows", "concerto", "concert", "festa", "festas", "party", "balada",
                     "baladas", "club", "clube", "dj", "noite", "night", "nightlife", "jazz", "rock", "house",
                     "afro house", "amapiano", "techno", "hip hop", "rap", "reggae", "samba", "karaoke", "bar", "bares",
                     "pub", "live music", "ao vivo", "gig", "rave", "electronic", "eletronica"],
        "places_query": "live music venues and night clubs",
        "tm_segment": "Music",
        "outdoor": None,
    },
    {
        "id": "movement", "label": "Movimento e bem-estar", "label_en": "Movement & wellness", "icon": "dumbbell",
        "keywords": ["yoga", "pilates", "academia", "gym", "treino", "workout", "corrida", "correr", "running", "run",
                     "parkrun", "meditacao", "meditation", "danca", "dance", "spa", "bem-estar", "bem estar", "wellness",
                     "crossfit", "funcional", "alongamento", "breathwork", "sauna", "massagem"],
        "places_query": "yoga studios and fitness classes",
        "tm_segment": None,
        "outdoor": None,
    },
    {
        "id": "sports-adventure", "label": "Esportes e aventuras", "label_en": "Sports & adventure", "icon": "compass",
        "keywords": ["surf", "surfe", "trilha", "trilhas", "hike", "hiking", "escalada", "climbing", "bike", "ciclismo",
                     "cycling", "mergulho", "diving", "snorkel", "kitesurf", "kite", "paddle", "sup", "caiaque", "kayak",
                     "parapente", "paragliding", "futebol", "football", "soccer", "rugby", "cricket", "volei", "volleyball",
                     "tenis", "tennis", "padel", "natacao", "swimming", "sandboard", "aventura", "adventure", "esporte",
                     "esportes", "sport", "sports", "jogo", "match"],
        "places_query": "outdoor adventure activities and sports clubs",
        "tm_segment": "Sports",
        "outdoor": True,
    },
    {
        "id": "arts-culture", "label": "Arte e cultura", "label_en": "Arts & culture", "icon": "frame",
        "keywords": ["arte", "art", "museu", "museum", "galeria", "gallery", "exposicao", "exhibition", "teatro", "theatre",
                     "theater", "cinema", "filme", "film", "livro", "livros", "book", "books", "livraria", "poesia",
                     "poetry", "workshop", "oficina", "fotografia", "photography", "cultura", "culture", "historia",
                     "history", "comedia", "comedy", "stand up", "stand-up", "danca contemporanea", "opera", "ballet"],
        "places_query": "art galleries museums and theatres",
        "tm_segment": "Arts & Theatre",
        "outdoor": False,
    },
    {
        "id": "food-community", "label": "Gastronomia e comunidade", "label_en": "Food & community", "icon": "fork",
        "keywords": ["comida", "food", "restaurante", "restaurant", "cafe", "coffee", "brunch", "jantar", "dinner",
                     "almoco", "lunch", "mercado", "market", "feira", "vinho", "wine", "degustacao", "tasting",
                     "cerveja", "beer", "cozinha", "cooking", "aula de culinaria", "comunidade", "community", "meetup",
                     "voluntariado", "volunteer", "idiomas", "language exchange", "intercambio", "gastronomia",
                     "piquenique", "picnic", "padaria", "bakery"],
        "places_query": "food markets and community spaces",
        "tm_segment": None,
        "outdoor": None,
    },
]

BY_ID = {c["id"]: c for c in CATEGORIES}

# Atividades específicas reconhecidas (frase → (categoria, rótulo, ao ar livre?)).
ACTIVITIES: dict[str, tuple[str, str, bool | None]] = {
    "afro house": ("music-night", "afro house", None),
    "amapiano": ("music-night", "amapiano", None),
    "techno": ("music-night", "techno", None),
    "jazz": ("music-night", "jazz", None),
    "live music": ("music-night", "música ao vivo", None),
    "musica ao vivo": ("music-night", "música ao vivo", None),
    "karaoke": ("music-night", "karaokê", False),
    "yoga": ("movement", "yoga", None),
    "pilates": ("movement", "pilates", False),
    "parkrun": ("movement", "parkrun", True),
    "corrida": ("movement", "corrida", True),
    "running": ("movement", "corrida", True),
    "crossfit": ("movement", "crossfit", False),
    "danca": ("movement", "dança", None),
    "surf": ("sports-adventure", "surf", True),
    "surfe": ("sports-adventure", "surf", True),
    "trilha": ("sports-adventure", "trilha", True),
    "hike": ("sports-adventure", "trilha", True),
    "hiking": ("sports-adventure", "trilha", True),
    "escalada": ("sports-adventure", "escalada", None),
    "climbing": ("sports-adventure", "escalada", None),
    "mergulho": ("sports-adventure", "mergulho", True),
    "kitesurf": ("sports-adventure", "kitesurf", True),
    "padel": ("sports-adventure", "padel", None),
    "rugby": ("sports-adventure", "rugby", True),
    "museu": ("arts-culture", "museu", False),
    "museum": ("arts-culture", "museu", False),
    "teatro": ("arts-culture", "teatro", False),
    "comedia": ("arts-culture", "comédia", False),
    "stand up": ("arts-culture", "stand-up", False),
    "galeria": ("arts-culture", "galeria", False),
    "mercado": ("food-community", "mercado", None),
    "market": ("food-community", "mercado", None),
    "feira": ("food-community", "feira", None),
    "vinho": ("food-community", "vinho", None),
    "wine": ("food-community", "vinho", None),
    "brunch": ("food-community", "brunch", None),
    "cafe": ("food-community", "café", False),
    "coffee": ("food-community", "café", False),
    "language exchange": ("food-community", "troca de idiomas", False),
    "voluntariado": ("food-community", "voluntariado", None),
}

# Bairros de Cape Town (forma normalizada → nome de exibição, centro aproximado lat/lon).
NEIGHBORHOODS: dict[str, tuple[str, float, float]] = {
    "sea point": ("Sea Point", -33.9175, 18.3870),
    "green point": ("Green Point", -33.9070, 18.4060),
    "mouille point": ("Mouille Point", -33.9010, 18.4030),
    "de waterkant": ("De Waterkant", -33.9150, 18.4170),
    "waterfront": ("V&A Waterfront", -33.9036, 18.4209),
    "v&a": ("V&A Waterfront", -33.9036, 18.4209),
    "city bowl": ("City Bowl", -33.9249, 18.4241),
    "centro": ("City Bowl", -33.9249, 18.4241),
    "cbd": ("City Bowl", -33.9249, 18.4241),
    "bo-kaap": ("Bo-Kaap", -33.9205, 18.4146),
    "bo kaap": ("Bo-Kaap", -33.9205, 18.4146),
    "gardens": ("Gardens", -33.9330, 18.4120),
    "tamboerskloof": ("Tamboerskloof", -33.9290, 18.4060),
    "kloof street": ("Gardens", -33.9300, 18.4110),
    "woodstock": ("Woodstock", -33.9270, 18.4480),
    "observatory": ("Observatory", -33.9380, 18.4720),
    "camps bay": ("Camps Bay", -33.9510, 18.3780),
    "clifton": ("Clifton", -33.9390, 18.3770),
    "bantry bay": ("Bantry Bay", -33.9280, 18.3780),
    "hout bay": ("Hout Bay", -34.0460, 18.3600),
    "constantia": ("Constantia", -34.0270, 18.4400),
    "newlands": ("Newlands", -33.9760, 18.4630),
    "claremont": ("Claremont", -33.9840, 18.4650),
    "rondebosch": ("Rondebosch", -33.9600, 18.4760),
    "muizenberg": ("Muizenberg", -34.1080, 18.4700),
    "kalk bay": ("Kalk Bay", -34.1280, 18.4490),
    "blouberg": ("Bloubergstrand", -33.8070, 18.4710),
    "bloubergstrand": ("Bloubergstrand", -33.8070, 18.4710),
    "stellenbosch": ("Stellenbosch", -33.9346, 18.8610),
}

FREE_WORDS = ["gratis", "gratuito", "gratuita", "free", "de graca", "sem custo"]
BUDGET_WORDS = ["barato", "barata", "baratos", "baratas", "cheap", "economico", "budget", "em conta", "low cost"]
PREMIUM_WORDS = ["luxo", "luxury", "sofisticado", "premium", "chique", "fine dining", "exclusivo"]
OUTDOOR_WORDS = ["ao ar livre", "outdoor", "outdoors", "praia", "beach", "parque", "park", "natureza", "nature",
                 "montanha", "mountain", "trilha", "por do sol", "sunset", "rooftop"]
INDOOR_WORDS = ["indoor", "coberto", "fechado", "em casa", "dentro"]
SOCIAL_WORDS = ["amigos", "amigas", "pessoas", "conhecer gente", "fazer amigos", "comunidade", "community",
                "grupo", "group", "meetup", "social", "turma", "galera"]
SOLO_WORDS = ["sozinha", "sozinho", "solo", "alone", "individual", "tranquilo", "tranquila", "sossego"]
EVENT_WORDS = ["evento", "eventos", "event", "events", "festa", "show", "concerto", "concert", "festival", "jogo",
               "match", "apresentacao", "sessao", "ingresso", "ingressos", "tickets"]
