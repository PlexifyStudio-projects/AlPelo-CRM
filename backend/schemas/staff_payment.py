from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class StaffPaymentCreate(BaseModel):
    staff_id: int
    amount: int
    period_from: date
    period_to: date
    concept: str
    payment_method: str
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    commission_total: int = 0
    tips_total: int = 0
    product_commissions: int = 0
    deductions: int = 0
    notes: Optional[str] = None


class StaffPaymentUpdate(BaseModel):
    amount: Optional[int] = None
    concept: Optional[str] = None
    payment_method: Optional[str] = None
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class StaffPaymentResponse(BaseModel):
    id: int
    tenant_id: int
    staff_id: int
    staff_name: str = ""
    amount: int
    period_from: date
    period_to: date
    concept: str
    payment_method: str
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    commission_total: int = 0
    tips_total: int = 0
    product_commissions: int = 0
    deductions: int = 0
    notes: Optional[str] = None
    paid_by: Optional[str] = None
    paid_at: Optional[datetime] = None
    status: str = "paid"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StaffPayrollSummary(BaseModel):
    staff_id: int
    staff_name: str
    staff_role: str = ""
    photo_url: Optional[str] = None
    commission_rate: float = 0.4
    total_earned: int = 0  # commissions + tips + product commissions in period
    total_paid: int = 0  # sum of payments in period
    balance: int = 0  # earned - paid (what's owed)
    services_count: int = 0
    payment_count: int = 0
