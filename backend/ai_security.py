# Proxy — real module moved to services/ai/security.py
from services.ai.security import *  # noqa
from services.ai.security import (
    detect_prompt_injection, get_safe_response_for_injection,
    validate_response, clean_response_for_whatsapp,
)
