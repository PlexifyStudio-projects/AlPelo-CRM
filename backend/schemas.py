from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


#========================= AUTH =========================#

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenRequest(BaseModel):
    user_id: int
    username: str
    role: str

class UserCredentials(BaseModel):
    user_id: int
    username: str
    role: str


#========================= ADMIN =========================#

class AdminSetupRequest(BaseModel):
    name: str
    email: str
    username: str
    password: str
    phone: Optional[str] = None

class AdminResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    username: str
    role: str
    is_active: bool
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str


#========================= STAFF =========================#

class StaffCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "Barbero"
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool = True
    skills: List[str] = []
    rating: Optional[float] = None
    color: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    skills: Optional[List[str]] = None
    rating: Optional[float] = None
    color: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class StaffResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool
    skills: List[str] = []
    rating: Optional[float] = None
    color: Optional[str] = None
    username: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StaffCredentialsUpdate(BaseModel):
    username: str
    password: str


#========================= CLIENT =========================#

class ClientCreate(BaseModel):
    client_id: Optional[str] = None              # Optional — auto-generated if not provided
    name: str
    phone: str
    email: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    accepts_whatsapp: bool = True
    tags: List[str] = []

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    accepts_whatsapp: Optional[bool] = None
    tags: Optional[List[str]] = None
    is_active: Optional[bool] = None
    status_override: Optional[str] = None       # manual status: activo, vip, en_riesgo, inactivo, nuevo, or null to reset

class ClientResponse(BaseModel):
    id: int
    client_id: str
    name: str
    phone: str
    email: Optional[str] = None
    birthday: Optional[date] = None
    favorite_service: Optional[str] = None
    preferred_barber_id: Optional[int] = None
    preferred_barber_name: Optional[str] = None
    accepts_whatsapp: bool
    tags: List[str] = []
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    # Computed fields
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
    is_active: bool
    tags: List[str] = []
    # Computed
    total_visits: int = 0
    total_spent: int = 0
    avg_ticket: int = 0
    last_visit: Optional[date] = None
    days_since_last_visit: Optional[int] = None
    status: str = "nuevo"

    class Config:
        from_attributes = True


#========================= VISIT HISTORY =========================#

class VisitHistoryCreate(BaseModel):
    client_id: int
    staff_id: int
    service_name: str
    amount: int                                 # COP sin decimales
    visit_date: date
    status: str = "completed"                   # completed, no_show, cancelled
    payment_method: Optional[str] = None        # efectivo, transferencia, tarjeta, nequi, daviplata
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


#========================= CLIENT NOTES =========================#

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


#========================= DASHBOARD =========================#

class DashboardKPIs(BaseModel):
    total_clients: int = 0
    active_clients: int = 0
    at_risk_clients: int = 0
    inactive_clients: int = 0
    vip_clients: int = 0
    new_clients: int = 0
    retention_rate: float = 0.0
    total_revenue: int = 0
    avg_ticket: int = 0


#========================= SERVICES =========================#

class ServiceCreate(BaseModel):
    name: str
    category: str
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: List[int] = []
    is_active: bool = True

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None

class ServiceResponse(BaseModel):
    id: int
    name: str
    category: str
    price: int
    duration_minutes: Optional[int] = None
    description: Optional[str] = None
    staff_ids: List[int] = []
    staff_names: List[str] = []
    is_active: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


#========================= APPOINTMENTS =========================#

class AppointmentCreate(BaseModel):
    client_id: Optional[int] = None
    client_name: str
    client_phone: str
    staff_id: int
    service_id: int
    date: date
    time: str                                   # HH:MM
    duration_minutes: Optional[int] = None      # auto-filled from service if not set
    price: Optional[int] = None                 # auto-filled from service if not set
    status: str = "confirmed"
    notes: Optional[str] = None
    created_by: Optional[str] = None

class AppointmentUpdate(BaseModel):
    client_id: Optional[int] = None
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    staff_id: Optional[int] = None
    service_id: Optional[int] = None
    date: Optional[str] = None  # str to avoid Pydantic v2 coercion issues with Optional[date]
    time: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: int
    client_id: Optional[int] = None
    client_name: str
    client_phone: str
    staff_id: int
    staff_name: Optional[str] = None
    service_id: int
    service_name: Optional[str] = None
    date: date
    time: str
    duration_minutes: int
    price: int
    status: str
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


#========================= DASHBOARD STATS =========================#

class AppointmentTodayItem(BaseModel):
    id: int
    time: str
    client_name: str
    service_name: Optional[str] = None
    staff_name: Optional[str] = None
    status: str

class PendingTaskItem(BaseModel):
    id: int
    client_id: int
    client_name: str
    content: str
    status: str = "pending"                 # pending, completed, expired
    created_at: Optional[datetime] = None

class PaymentAlertItem(BaseModel):
    conversation_id: int
    client_name: str
    phone: str
    created_at: Optional[datetime] = None

class TopServiceItem(BaseModel):
    name: str
    count: int

class DashboardStatsResponse(BaseModel):
    # Client metrics
    total_clients: int = 0
    active_clients: int = 0
    vip_clients: int = 0
    at_risk_clients: int = 0
    new_clients_this_month: int = 0

    # Today's activity
    appointments_today: int = 0
    appointments_today_list: List[AppointmentTodayItem] = []
    completed_today: int = 0

    # Revenue
    revenue_today: int = 0
    revenue_this_week: int = 0
    revenue_this_month: int = 0

    # WhatsApp
    whatsapp_messages_today: int = 0
    whatsapp_active_conversations: int = 0
    whatsapp_total_conversations: int = 0
    whatsapp_unread: int = 0

    # Lina
    lina_is_global_active: bool = False
    lina_messages_today: int = 0
    lina_actions_today: int = 0

    # Pending tasks
    pending_tasks: List[PendingTaskItem] = []

    # Payment alerts (conversations tagged as "Pago pendiente" or AI paused)
    payment_alerts: List[PaymentAlertItem] = []

    # Top services today
    top_services_today: List[TopServiceItem] = []

    # Revenue chart (last 7 days from paid appointments)
    revenue_by_day: List[dict] = []

    # Revenue forecast
    revenue_forecast_7d: int = 0
    revenue_forecast_30d: int = 0

    # Client intelligence
    clients_overdue: int = 0
    clients_critical: int = 0


#========================= FINANCES =========================#

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
    # Comparison with previous period
    prev_revenue: int = 0
    prev_visits: int = 0
    revenue_growth_pct: Optional[float] = None
    visits_growth_pct: Optional[float] = None
    # Highlights
    best_day_date: Optional[str] = None
    best_day_revenue: int = 0
    busiest_day_date: Optional[str] = None
    busiest_day_visits: int = 0


#========================= TOGGLE AI =========================#

class ToggleAllAIRequest(BaseModel):
    enable: bool

class ToggleAllAIResponse(BaseModel):
    updated: int
    is_active: bool


#========================= AI CONFIG =========================#

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


#========================= WHATSAPP =========================#

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


#========================= EXPENSES =========================#

class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: int                                 # COP
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


#========================= COMMISSIONS =========================#

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


#========================= INVOICES =========================#

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
    items: List[InvoiceItemCreate]
    tax_rate: float = 0.19
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    issued_date: Optional[date] = None

class InvoiceUpdate(BaseModel):
    status: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    client_document: Optional[str] = None

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
    subtotal: int
    tax_rate: float
    tax_amount: int
    total: int
    payment_method: Optional[str] = None
    status: str
    issued_date: date
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


#========================= P&L =========================#

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


#========================= UNINVOICED VISITS =========================#

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


#========================= IMPORT/EXPORT =========================#

class ImportResult(BaseModel):
    imported: int = 0
    skipped: int = 0
    errors: List[str] = []


#========================= CAMPAIGNS =========================#

class CampaignCreate(BaseModel):
    name: str
    campaign_type: Optional[str] = "promo"
    message_body: Optional[str] = None
    segment_filters: Optional[dict] = {}
    created_by: Optional[str] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    status: Optional[str] = None
    message_body: Optional[str] = None
    meta_template_name: Optional[str] = None
    segment_filters: Optional[dict] = None

class CampaignResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    campaign_type: Optional[str] = None
    status: str = "draft"
    message_body: Optional[str] = None
    meta_template_name: Optional[str] = None
    meta_template_id: Optional[str] = None
    meta_status: Optional[str] = None
    segment_filters: Optional[dict] = {}
    audience_count: int = 0
    sent_count: int = 0
    failed_count: int = 0
    responded_count: int = 0
    ai_variants: Optional[list] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
