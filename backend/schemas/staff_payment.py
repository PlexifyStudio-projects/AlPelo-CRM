from pydantic import BaseModel
from typing import Optional, List
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
    visit_ids: Optional[List[int]] = None  # Link specific visit_history records to this payment
    appointment_ids: Optional[List[int]] = None  # Link specific appointments to this payment


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
    receipt_number: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FineItem(BaseModel):
    id: int
    reason: str
    amount: int
    fine_date: str
    notes: str = ""

class StaffPayrollSummary(BaseModel):
    staff_id: int
    staff_name: str
    staff_role: str = ""
    photo_url: Optional[str] = None
    commission_rate: float = 0.4
    total_earned: int = 0
    total_paid: int = 0
    balance: int = 0
    services_count: int = 0
    unpaid_services_count: int = 0  # Visits not yet linked to any payment
    payment_count: int = 0
    # Fines
    fines_total: int = 0
    fines_count: int = 0
    fines: list[FineItem] = []
    # Bank info summary for pay modal
    preferred_payment_method: Optional[str] = None
    has_bank_info: bool = False


# --- Detail endpoint schemas ---

class VisitDetailItem(BaseModel):
    id: int
    client_name: Optional[str] = None
    service_name: str
    amount: int = 0
    visit_date: date
    payment_method: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class StaffBankInfo(BaseModel):
    document_type: Optional[str] = None
    document_number_masked: Optional[str] = None  # ****4567
    bank_name: Optional[str] = None
    bank_account_type: Optional[str] = None
    bank_account_number_masked: Optional[str] = None  # ****4567
    nequi_phone_masked: Optional[str] = None  # ***4567
    daviplata_phone_masked: Optional[str] = None
    preferred_payment_method: Optional[str] = None


class StaffPaymentDetailResponse(StaffPaymentResponse):
    visits: List[VisitDetailItem] = []
    staff_bank: Optional[StaffBankInfo] = None
    staff_role: str = ""
    staff_photo_url: Optional[str] = None
    tenant_name: Optional[str] = None
    tenant_address: Optional[str] = None
    tenant_phone: Optional[str] = None
    tenant_logo_url: Optional[str] = None
    tenant_nit: Optional[str] = None
