"""
Middleware Layer

Global protection: CORS, Authentication.
"""
from .cors import setup_cors_middleware

__all__ = [
    'setup_cors_middleware'
]
