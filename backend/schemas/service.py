from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class ServiceCreate(BaseModel):
    name: str
    category: str
    service_type: str = "cita"  # cita, paquete, reserva
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: List[int] = []
    ai_mode: str = "auto"  # auto = Lina books, manual = Lina pauses + notifies admin
    is_active: bool = True
    photo_url: Optional[str] = None

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    service_type: Optional[str] = None
    price: Optional[int] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: Optional[List[int]] = None
    ai_mode: Optional[str] = None
    is_active: Optional[bool] = None
    photo_url: Optional[str] = None

class ServiceResponse(BaseModel):
    id: int
    name: str
    category: str
    service_type: str = "cita"
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: List[int] = []
    ai_mode: str = "auto"
    staff_names: List[str] = []
    is_active: bool
    photo_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionCreate(BaseModel):
    client_id: int
    service_id: Optional[int] = None
    service_name: str
    expires_at: Optional[datetime] = None
    sessions_total: Optional[int] = None
    amount_paid: int = 0
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class SubscriptionUpdate(BaseModel):
    status: Optional[str] = None
    expires_at: Optional[datetime] = None
    sessions_total: Optional[int] = None
    sessions_used: Optional[int] = None
    amount_paid: Optional[int] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
