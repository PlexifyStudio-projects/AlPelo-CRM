from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class ClientCreate(BaseModel):
    client_id: Optional[str] = None
    name: str
    phone: str
    email: Optional[str] = None
    document_type: Optional[str] = None  # CC, CE, TI, NIT, Pasaporte
    document_number: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    accepts_whatsapp: bool = True
    tags: List[str] = []

class ClientUpdate(BaseModel):
    client_id: Optional[str] = None  # Ticket number, editable
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    accepts_whatsapp: Optional[bool] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    status_override: Optional[str] = None

class ClientResponse(BaseModel):
    id: int
    client_id: str
    name: str
    phone: str
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    preferred_barber_name: Optional[str] = None
    accepts_whatsapp: bool
    tags: List[str] = []
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    total_visits: int = 0
    total_spent: int = 0
    avg_ticket: int = 0
    last_visit: Optional[date] = None
    days_since_last_visit: Optional[int] = None
    no_show_count: int = 0
    status: str = "nuevo"

    class Config:
        from_attributes = True

class ClientListResponse(BaseModel):
    id: int
    client_id: str
    name: str
    phone: str
    email: Optional[str] = None
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    is_active: bool
    tags: List[str] = []
    total_visits: int = 0
    total_spent: int = 0
    avg_ticket: int = 0
    last_visit: Optional[date] = None
    days_since_last_visit: Optional[int] = None
    status: str = "nuevo"

    class Config:
        from_attributes = True

class ClientNoteCreate(BaseModel):
    client_id: int
    content: str
    created_by: Optional[str] = None

class ClientNoteResponse(BaseModel):
    id: int
    client_id: int
    content: str
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
