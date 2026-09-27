"""
Universal Steam language mapping registry with automatic fallback.
Supports all 28 officially supported Steam languages.
Silently rolls back any 'ru'/'russian' requests to Ukrainian.
"""
from typing import Dict

APP_TO_STEAM_LANGUAGES: Dict[str, str] = {
    "ua": "ukrainian",
    "en": "english",
    "de": "german",
    "fr": "french",
    "it": "italian",
    "es": "spanish",
    "latam": "latam",
    "pl": "polish",
    "pt": "portuguese",
    "pt-br": "brazilian",
    "cs": "czech",
    "da": "danish",
    "nl": "dutch",
    "fi": "finnish",
    "el": "greek",
    "hu": "hungarian",
    "ja": "japanese",
    "ko": "korean",
    "no": "norwegian",
    "ro": "romanian",
    "zh-cn": "schinese",
    "zh-tw": "tchinese",
    "sv": "swedish",
    "th": "thai",
    "tr": "turkish",
    "bg": "bulgarian",
    "vi": "vietnamese",
    "id": "indonesian"
}

def get_steam_language(lang_code: str) -> str:
    """Returns the Steam language identifier, silently rolling back 'ru' to 'ukrainian'."""
    if not lang_code or not isinstance(lang_code, str):
        return "english"
    code = lang_code.strip().lower()
    if code in ("ru", "russian", "ru-ru"):
        return "ukrainian"
    return APP_TO_STEAM_LANGUAGES.get(code, "english")
