"""
AI Embeddings — Generate vector embeddings for semantic memory search.

Priority:
1. OpenAI text-embedding-3-small (best quality, $0.00002/1K tokens)
2. HuggingFace sentence-transformers (free, slower)
3. Fallback: None (skip embeddings, use keyword matching)

Environment variables:
- OPENAI_API_KEY: OpenAI API key (recommended)
- HF_API_TOKEN: HuggingFace token (fallback)
"""

import os
import httpx
import json
from typing import List, Optional

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
HF_API_TOKEN = os.getenv("HF_API_TOKEN", "")

# Embedding dimensions per provider
OPENAI_DIMS = 1536
HF_DIMS = 384

_active_provider = None


def get_embedding_provider() -> Optional[str]:
    """Detect which embedding provider is available."""
    global _active_provider
    if _active_provider:
        return _active_provider
    if OPENAI_API_KEY:
        _active_provider = "openai"
    elif HF_API_TOKEN:
        _active_provider = "huggingface"
    else:
        _active_provider = None
    return _active_provider


def get_embedding_dims() -> int:
    """Return the embedding dimension for the active provider."""
    provider = get_embedding_provider()
    if provider == "openai":
        return OPENAI_DIMS
    elif provider == "huggingface":
        return HF_DIMS
    return 0


def create_embedding_sync(text: str) -> Optional[List[float]]:
    """Generate embedding vector for a text string (synchronous)."""
    provider = get_embedding_provider()
    if not provider:
        return None

    try:
        if provider == "openai":
            return _openai_embedding(text)
        elif provider == "huggingface":
            return _hf_embedding(text)
    except Exception as e:
        print(f"[EMBEDDINGS] Error with {provider}: {e}")
        return None


async def create_embedding(text: str) -> Optional[List[float]]:
    """Generate embedding vector for a text string (async)."""
    provider = get_embedding_provider()
    if not provider:
        return None

    try:
        if provider == "openai":
            return await _openai_embedding_async(text)
        elif provider == "huggingface":
            return await _hf_embedding_async(text)
    except Exception as e:
        print(f"[EMBEDDINGS] Error with {provider}: {e}")
        return None


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ============================================================================
# OpenAI
# ============================================================================

def _openai_embedding(text: str) -> Optional[List[float]]:
    """Sync OpenAI embedding."""
    with httpx.Client(timeout=15) as client:
        resp = client.post(
            "https://api.openai.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "text-embedding-3-small",
                "input": text[:8000],  # Truncate to avoid token limits
            },
        )
        data = resp.json()
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]
        print(f"[EMBEDDINGS] OpenAI error: {data.get('error', data)}")
        return None


async def _openai_embedding_async(text: str) -> Optional[List[float]]:
    """Async OpenAI embedding."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "text-embedding-3-small",
                "input": text[:8000],
            },
        )
        data = resp.json()
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]
        print(f"[EMBEDDINGS] OpenAI error: {data.get('error', data)}")
        return None


# ============================================================================
# HuggingFace
# ============================================================================

HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
HF_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{HF_MODEL}"


def _hf_embedding(text: str) -> Optional[List[float]]:
    """Sync HuggingFace embedding."""
    with httpx.Client(timeout=30) as client:
        resp = client.post(
            HF_URL,
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            json={"inputs": text[:1000], "options": {"wait_for_model": True}},
        )
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            # Model returns token-level embeddings, average them
            if isinstance(data[0], list):
                n = len(data)
                dim = len(data[0])
                avg = [sum(data[i][j] for i in range(n)) / n for j in range(dim)]
                return avg
            return data
        print(f"[EMBEDDINGS] HuggingFace error: {str(data)[:200]}")
        return None


async def _hf_embedding_async(text: str) -> Optional[List[float]]:
    """Async HuggingFace embedding."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            HF_URL,
            headers={"Authorization": f"Bearer {HF_API_TOKEN}"},
            json={"inputs": text[:1000], "options": {"wait_for_model": True}},
        )
        data = resp.json()
        if isinstance(data, list) and len(data) > 0:
            if isinstance(data[0], list):
                n = len(data)
                dim = len(data[0])
                avg = [sum(data[i][j] for i in range(n)) / n for j in range(dim)]
                return avg
            return data
        print(f"[EMBEDDINGS] HuggingFace error: {str(data)[:200]}")
        return None
