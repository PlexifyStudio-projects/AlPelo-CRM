from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


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

class AppointmentTodayItem(BaseModel):
    id: int
    time: str
    client_name: str
    service_name: Optional[str] = None
    staff_name: Optional[str] = None
    status: str
    noshow_risk: int = 0

class PendingTaskItem(BaseModel):
    id: int
    client_id: int
    client_name: str
    content: str
    status: str = "pending"
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
    total_clients: int = 0
    active_clients: int = 0
    vip_clients: int = 0
    at_risk_clients: int = 0
    new_clients_this_month: int = 0
    appointments_today: int = 0
    appointments_today_list: List[AppointmentTodayItem] = []
    completed_today: int = 0
    revenue_today: int = 0
    revenue_this_week: int = 0
    revenue_this_month: int = 0
    whatsapp_messages_today: int = 0
    whatsapp_active_conversations: int = 0
    whatsapp_total_conversations: int = 0
    whatsapp_unread: int = 0
    lina_is_global_active: bool = False
    lina_messages_today: int = 0
    lina_actions_today: int = 0
    pending_tasks: List[PendingTaskItem] = []
    payment_alerts: List[PaymentAlertItem] = []
    top_services_today: List[TopServiceItem] = []
    revenue_by_day: List[dict] = []
    revenue_forecast_7d: int = 0
    revenue_forecast_30d: int = 0
    clients_overdue: int = 0
    clients_critical: int = 0
