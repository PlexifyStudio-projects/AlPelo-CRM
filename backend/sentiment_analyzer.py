# ============================================================================
# Plexify Studio — Sentiment Analyzer
# Rule-based (ZERO AI tokens). Analyzes Spanish WhatsApp messages.
# Returns: sentiment (positive/neutral/negative/urgent), score, matched words.
# ============================================================================

import re
from typing import Tuple, List

# --- Keyword dictionaries (Spanish / LATAM colloquial) ---

_POSITIVE_WORDS = {
    # Direct positive
    "gracias", "genial", "excelente", "perfecto", "increible", "increíble",
    "maravilloso", "espectacular", "brutal", "chevere", "chévere", "bacano",
    "super", "súper", "buenisimo", "buenísimo", "encanta", "encantado",
    "encantada", "feliz", "contento", "contenta", "satisfecho", "satisfecha",
    "agradecido", "agradecida", "recomiendo", "recomendado", "fabuloso",
    "hermoso", "divino", "divina", "precioso", "preciosa", "top",
    # Service satisfaction
    "quedo genial", "me encanto", "me encantó", "quede feliz", "quedé feliz",
    "muy bien", "muy bueno", "lo mejor", "el mejor", "la mejor",
    "gran servicio", "buen trabajo", "excelente servicio", "100%",
    # Emojis as text
    "jaja", "jajaja", "jeje", "jejeje",
    # Gratitude
    "mil gracias", "muchas gracias", "gracias por todo", "bendiciones",
    # Confirmation happy
    "dale", "listo", "vale", "eso", "asi es", "así es", "claro",
}

_NEGATIVE_WORDS = {
    # Frustration / anger
    "molesto", "molesta", "enojado", "enojada", "furioso", "furiosa",
    "indignado", "indignada", "decepcionado", "decepcionada", "decepcion",
    "decepción", "disgusto", "disgustado", "disgustada",
    # Complaints
    "queja", "quejar", "reclamo", "reclamar", "horrible", "terrible",
    "pesimo", "pésimo", "pesima", "pésima", "mal servicio", "mala atencion",
    "mala atención", "inaceptable", "inadmisible", "vergonzoso", "vergonzosa",
    "desastre", "porqueria", "porquería", "basura", "asco",
    # Dissatisfaction
    "no me gusto", "no me gustó", "quedo mal", "quedó mal", "no sirve",
    "no funciona", "no sirven", "arruinaron", "danaron", "dañaron",
    "estropearon", "maltrataron",
    # Leaving / churn signals
    "no vuelvo", "no regreso", "buscare otro", "buscaré otro",
    "cambiar de", "me voy", "voy a otro", "otro lugar", "otra parte",
    "competencia",
    # Money issues
    "caro", "costoso", "robo", "estafa", "cobro de mas", "cobro de más",
    "me cobraron", "sobrecobro",
    # Wait / time
    "espere mucho", "esperé mucho", "llevo esperando", "demoran mucho",
    "tardan mucho", "lento", "lenta",
}

_URGENT_WORDS = {
    # Emergency / urgency
    "urgente", "emergencia", "ayuda", "por favor urgente",
    "necesito ya", "ahora mismo", "inmediatamente", "cuanto antes",
    # Anger escalation
    "hablar con el dueño", "hablar con el jefe", "quiero hablar con",
    "gerente", "supervisor", "responsable", "encargado",
    # Threats
    "demanda", "demandar", "abogado", "denuncia", "denunciar",
    "redes sociales", "voy a publicar", "google reviews",
    # Strong negative
    "peor experiencia", "nunca en mi vida", "jamas", "jamás",
    "inaceptable", "intolerable",
}

# Compiled patterns for multi-word matching
_NEGATIVE_PATTERNS = [
    re.compile(r"\bno\s+me\s+gust[oó]\b", re.IGNORECASE),
    re.compile(r"\bqued[oó]\s+mal\b", re.IGNORECASE),
    re.compile(r"\bmal\s+servicio\b", re.IGNORECASE),
    re.compile(r"\bmala\s+atenci[oó]n\b", re.IGNORECASE),
    re.compile(r"\bno\s+vuelvo\b", re.IGNORECASE),
    re.compile(r"\bno\s+sirve\b", re.IGNORECASE),
    re.compile(r"\bcobro\s+de\s+m[aá]s\b", re.IGNORECASE),
    re.compile(r"\besper[eé]\s+mucho\b", re.IGNORECASE),
    re.compile(r"\bdemoran\s+mucho\b", re.IGNORECASE),
    re.compile(r"\bvoy\s+a\s+otro\b", re.IGNORECASE),
    re.compile(r"\bbuscar[eé]\s+otro\b", re.IGNORECASE),
]

_URGENT_PATTERNS = [
    re.compile(r"\bhablar\s+con\s+el\s+(due[nñ]o|jefe|gerente|encargado)\b", re.IGNORECASE),
    re.compile(r"\bquiero\s+hablar\s+con\b", re.IGNORECASE),
    re.compile(r"\bpeor\s+experiencia\b", re.IGNORECASE),
    re.compile(r"\bnunca\s+en\s+mi\s+vida\b", re.IGNORECASE),
    re.compile(r"\bvoy\s+a\s+publicar\b", re.IGNORECASE),
    re.compile(r"\bpor\s+favor\s+urgente\b", re.IGNORECASE),
    re.compile(r"\bnecesito\s+ya\b", re.IGNORECASE),
]

_POSITIVE_PATTERNS = [
    re.compile(r"\bme\s+encant[oó]\b", re.IGNORECASE),
    re.compile(r"\bqued[eé]\s+feliz\b", re.IGNORECASE),
    re.compile(r"\bmuy\s+bien\b", re.IGNORECASE),
    re.compile(r"\bmuy\s+bueno\b", re.IGNORECASE),
    re.compile(r"\bgran\s+servicio\b", re.IGNORECASE),
    re.compile(r"\bbuen\s+trabajo\b", re.IGNORECASE),
    re.compile(r"\bexcelente\s+servicio\b", re.IGNORECASE),
    re.compile(r"\bmil\s+gracias\b", re.IGNORECASE),
    re.compile(r"\bmuchas\s+gracias\b", re.IGNORECASE),
    re.compile(r"\blo\s+mejor\b", re.IGNORECASE),
    re.compile(r"\bel\s+mejor\b", re.IGNORECASE),
    re.compile(r"\bla\s+mejor\b", re.IGNORECASE),
]

# Emoji sentiment (common WhatsApp emojis)
_POSITIVE_EMOJIS = {"😊", "😄", "😁", "🥰", "❤️", "💚", "👍", "👏", "🙏", "😍",
                     "🤩", "💪", "🔥", "✨", "💯", "😃", "☺️", "🫶", "💕", "🤗"}
_NEGATIVE_EMOJIS = {"😡", "🤬", "😤", "😠", "💔", "👎", "😞", "😢", "😭", "😒",
                     "🙄", "😑", "😩", "😫", "🤮", "💩"}


def _normalize(text: str) -> str:
    """Lowercase and strip for matching."""
    return text.lower().strip()


def analyze_sentiment(text: str) -> dict:
    """Analyze sentiment of a WhatsApp message.

    Returns:
        {
            "sentiment": "positive" | "neutral" | "negative" | "urgent",
            "score": float (-1.0 to 1.0),
            "matched": list[str]  # keywords/patterns that matched
        }
    """
    if not text or not text.strip():
        return {"sentiment": "neutral", "score": 0.0, "matched": []}

    normalized = _normalize(text)
    matched = []
    pos_score = 0.0
    neg_score = 0.0
    urgent = False

    # --- Check urgent patterns first (highest priority) ---
    for pattern in _URGENT_PATTERNS:
        m = pattern.search(normalized)
        if m:
            matched.append(f"urgent:{m.group()}")
            urgent = True
            neg_score += 3.0

    for word in _URGENT_WORDS:
        if word in normalized:
            if not any(word in m for m in matched):
                matched.append(f"urgent:{word}")
                urgent = True
                neg_score += 2.5

    # --- Check negative patterns ---
    for pattern in _NEGATIVE_PATTERNS:
        m = pattern.search(normalized)
        if m:
            matched.append(f"neg:{m.group()}")
            neg_score += 2.0

    for word in _NEGATIVE_WORDS:
        # Match whole-ish word (allow for conjugations)
        if re.search(rf"\b{re.escape(word)}\b", normalized):
            if not any(word in m for m in matched):
                matched.append(f"neg:{word}")
                neg_score += 1.5

    # --- Check positive patterns ---
    for pattern in _POSITIVE_PATTERNS:
        m = pattern.search(normalized)
        if m:
            matched.append(f"pos:{m.group()}")
            pos_score += 2.0

    for word in _POSITIVE_WORDS:
        if re.search(rf"\b{re.escape(word)}\b", normalized):
            if not any(word in m for m in matched):
                matched.append(f"pos:{word}")
                pos_score += 1.0

    # --- Check emojis ---
    for emoji in _POSITIVE_EMOJIS:
        count = text.count(emoji)
        if count > 0:
            pos_score += 0.5 * count
            matched.append(f"pos:{emoji}")

    for emoji in _NEGATIVE_EMOJIS:
        count = text.count(emoji)
        if count > 0:
            neg_score += 0.8 * count
            matched.append(f"neg:{emoji}")

    # --- ALL CAPS detection (shouting) ---
    words = text.split()
    caps_words = [w for w in words if len(w) > 2 and w.isupper() and w.isalpha()]
    if len(caps_words) >= 2:
        neg_score += 1.0 * len(caps_words)
        matched.append(f"neg:CAPS({len(caps_words)} words)")

    # --- Excessive punctuation (!!!, ???) ---
    if text.count("!") >= 3:
        neg_score += 0.5
        matched.append("neg:!!!")
    if text.count("?") >= 3:
        neg_score += 0.3

    # --- Calculate final score ---
    total = pos_score + neg_score
    if total == 0:
        return {"sentiment": "neutral", "score": 0.0, "matched": []}

    # Score: -1.0 (very negative) to +1.0 (very positive)
    raw_score = (pos_score - neg_score) / max(total, 1.0)
    score = max(-1.0, min(1.0, raw_score))

    # --- Determine sentiment ---
    if urgent:
        sentiment = "urgent"
    elif neg_score >= 3.0 and neg_score > pos_score:
        sentiment = "negative"
    elif pos_score >= 2.0 and pos_score > neg_score * 1.5:
        sentiment = "positive"
    elif neg_score > pos_score and neg_score >= 1.5:
        sentiment = "negative"
    elif pos_score > neg_score:
        sentiment = "positive"
    else:
        sentiment = "neutral"

    return {
        "sentiment": sentiment,
        "score": round(score, 2),
        "matched": matched[:10],  # Cap at 10 matches
    }


def get_sentiment_label(sentiment: str) -> str:
    """Return Spanish label for display."""
    return {
        "positive": "Positivo",
        "neutral": "Neutral",
        "negative": "Negativo",
        "urgent": "Urgente",
    }.get(sentiment, "Neutral")
