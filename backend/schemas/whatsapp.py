from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class WhatsAppConversationResponse(BaseModel):
    id: int
    client_id: Optional[int] = None
    wa_contact_phone: str
    wa_contact_name: Optional[str] = None
    last_message_at: Optional[datetime] = None
    is_ai_active: bool
    unread_count: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WhatsAppMessageCreate(BaseModel):
    conversation_id: int
    content: str
    message_type: str = "text"

class WhatsAppMessageResponse(BaseModel):
    id: int
    conversation_id: int
    wa_message_id: Optional[str] = None
    direction: str
    content: str
    message_type: str
    status: str
    sent_by: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
