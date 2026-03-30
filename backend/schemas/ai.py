from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AIConfigCreate(BaseModel):
    name: str = "Lina IA"
    system_prompt: str
    model: str = "claude-sonnet-4-20250514"
    provider: str = "anthropic"
    temperature: float = 0.7
    max_tokens: int = 1024

class AIConfigUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    is_active: Optional[bool] = None

class AIConfigResponse(BaseModel):
    id: int
    name: str
    system_prompt: str
    model: str
    provider: str
    temperature: float
    max_tokens: int
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AIChatRequest(BaseModel):
    message: str
    conversation_history: List[dict] = []
    image_base64: Optional[str] = None
    image_mime: Optional[str] = None

class AIChatResponse(BaseModel):
    response: str
    tokens_used: int = 0
