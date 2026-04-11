from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class AppointmentCreate(BaseModel):
    client_id: Optional[int] = None
    client_name: str
    client_phone: str
    staff_id: int
    service_id: int
    date: date
    time: str
    duration_minutes: Optional[int] = None
    price: Optional[int] = None
    status: str = "confirmed"
    visit_code: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None

class AppointmentUpdate(BaseModel):
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    staff_id: Optional[int] = None
    service_id: Optional[int] = None
    date: Optional[str] = None
    time: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[int] = None
    status: Optional[str] = None
    visit_code: Optional[str] = None
    notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: Optional[str] = ""
    client_phone: Optional[str] = ""
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None
    service_id: Optional[int] = None
    service_name: Optional[str] = None
    date: date
    time: str
    duration_minutes: Optional[int] = 30
    price: Optional[int] = 0
    status: str
    visit_code: Optional[str] = None
    notes: Optional[str] = None
    staff_payment_id: Optional[int] = None  # Linked payroll payment
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class VisitHistoryCreate(BaseModel):
    client_id: int
    staff_id: int
    service_name: str
    amount: int
    visit_date: date
    status: str = "completed"
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class VisitHistoryUpdate(BaseModel):
    staff_id: Optional[int] = None
    service_name: Optional[str] = None
    amount: Optional[int] = None
    visit_date: Optional[date] = None
    status: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class VisitHistoryResponse(BaseModel):
    id: int
    client_id: int
    staff_id: int
    staff_name: Optional[str] = None
    service_name: str
    amount: int
    visit_date: date
    status: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
