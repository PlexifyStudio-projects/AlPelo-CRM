from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class RevenueDayItem(BaseModel):
    date: str
    revenue: int
    visits: int

class RevenueServiceItem(BaseModel):
    service_name: str
    category: Optional[str] = None
    revenue: int
    count: int
    pct_of_total: float = 0.0

class RevenueStaffItem(BaseModel):
    staff_name: str
    revenue: int
    count: int
    avg_ticket: int = 0
    pct_of_total: float = 0.0

class RevenueCategoryItem(BaseModel):
    category: str
    revenue: int
    count: int
    pct_of_total: float = 0.0

class FinancialSummaryResponse(BaseModel):
    period: str
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    total_revenue: int = 0
    total_visits: int = 0
    avg_ticket: int = 0
    unique_clients: int = 0
    revenue_by_day: List[RevenueDayItem] = []
    revenue_by_service: List[RevenueServiceItem] = []
    revenue_by_staff: List[RevenueStaffItem] = []
    revenue_by_category: List[RevenueCategoryItem] = []
    pending_payments: int = 0
    prev_revenue: int = 0
    prev_visits: int = 0
    revenue_growth_pct: Optional[float] = None
    visits_growth_pct: Optional[float] = None
    best_day_date: Optional[str] = None
    best_day_revenue: int = 0
    busiest_day_date: Optional[str] = None
    busiest_day_visits: int = 0

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: int
    date: date
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    subcategory: Optional[str] = None
    vendor: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    created_by: Optional[str] = None

class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[int] = None
    date: Optional[date] = None
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    subcategory: Optional[str] = None
    vendor: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_frequency: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: int
    category: str
    description: str
    amount: int
    date: date
    payment_method: Optional[str] = None
    receipt_url: Optional[str] = None
    subcategory: Optional[str] = None
    vendor: Optional[str] = None
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ExpenseSummaryItem(BaseModel):
    category: str
    total: int
    count: int
    pct_of_total: float = 0.0

class CommissionConfigResponse(BaseModel):
    staff_id: int
    staff_name: str
    default_rate: float
    service_overrides: dict = {}

class CommissionConfigUpdate(BaseModel):
    default_rate: float
    service_overrides: dict = {}

class CommissionPayoutItem(BaseModel):
    staff_id: int
    staff_name: str
    rate: float
    total_revenue: int
    commission_amount: int
    services_count: int

class InvoiceItemCreate(BaseModel):
    service_name: str
    quantity: int = 1
    unit_price: int
    staff_name: Optional[str] = None
    visit_id: Optional[int] = None

class InvoiceCreate(BaseModel):
    client_id: Optional[int] = None
    client_name: str
    client_phone: Optional[str] = None
    client_document: Optional[str] = None
    client_document_type: Optional[str] = None  # CC, NIT, CE, TI, Pasaporte, DIE
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    items: List[InvoiceItemCreate]
    tax_rate: float = 0.19
    discount_type: Optional[str] = None  # percent, fixed
    discount_value: int = 0
    payment_method: Optional[str] = None
    payment_terms: str = "contado"  # contado, credito
    due_date: Optional[date] = None
    notes: Optional[str] = None
    issued_date: Optional[date] = None

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    payment_method: Optional[str] = None
    payment_terms: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    client_document: Optional[str] = None
    client_document_type: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None

class InvoiceItemResponse(BaseModel):
    id: int
    service_name: str
    quantity: int
    unit_price: int
    total: int
    staff_name: Optional[str] = None
    visit_id: Optional[int] = None

    class Config:
        from_attributes = True

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    client_id: Optional[int] = None
    client_name: str
    client_phone: Optional[str] = None
    client_document: Optional[str] = None
    client_document_type: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    subtotal: int
    discount_type: Optional[str] = None
    discount_value: int = 0
    discount_amount: int = 0
    tax_rate: float
    tax_amount: int
    total: int
    payment_method: Optional[str] = None
    payment_terms: str = "contado"
    due_date: Optional[date] = None
    status: str
    issued_date: date
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PnLResponse(BaseModel):
    period: str
    date_from: str
    date_to: str
    total_revenue: int = 0
    total_expenses: int = 0
    total_commissions: int = 0
    net_profit: int = 0
    margin_pct: float = 0.0

class PaymentMethodItem(BaseModel):
    method: str
    count: int
    total: int
    pct_of_total: float = 0.0

class UninvoicedVisitResponse(BaseModel):
    id: int
    client_id: int
    client_name: str
    staff_name: str
    service_name: str
    amount: int
    visit_date: date

    class Config:
        from_attributes = True
