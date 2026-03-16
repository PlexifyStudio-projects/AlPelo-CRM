from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, Float, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from database.connection import Base
from datetime import datetime


class Admin(Base):
    __tablename__ = "admin"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="admin")
    is_active = Column(Boolean, default=True)
    tenant_id = Column(Integer, nullable=True)  # Links admin to a tenant
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Barbero")
    specialty = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    hire_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    skills = Column(JSON, default=list)
    rating = Column(Float, nullable=True)
    color = Column(String, nullable=True)  # hex color for calendar, e.g. "#2D5A3D"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visits = relationship("VisitHistory", back_populates="staff")


class Client(Base):
    __tablename__ = "client"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, unique=True, index=True, nullable=False)  # M20201 format
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    birthday = Column(Date, nullable=True)
    favorite_service = Column(String, nullable=True)
    preferred_barber_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    accepts_whatsapp = Column(Boolean, default=True)
    tags = Column(JSON, default=list)
    status_override = Column(String, nullable=True)  # manual override: activo, vip, en_riesgo, inactivo, nuevo
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferred_barber = relationship("Staff", foreign_keys=[preferred_barber_id])
    visits = relationship("VisitHistory", back_populates="client", order_by="VisitHistory.visit_date.desc()")
    notes = relationship("ClientNote", back_populates="client", order_by="ClientNote.created_at.desc()")


class VisitHistory(Base):
    __tablename__ = "visit_history"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    service_name = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)  # COP sin decimales
    visit_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="completed")  # completed, no_show, cancelled
    payment_method = Column(String, nullable=True)  # efectivo, transferencia, tarjeta, nequi, daviplata
    notes = Column(Text, nullable=True)
    is_invoiced = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="visits")
    staff = relationship("Staff", back_populates="visits")


class ClientNote(Base):
    __tablename__ = "client_note"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String, nullable=True)  # nombre de quien la creo
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="notes")


class AIConfig(Base):
    __tablename__ = "ai_config"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="Lina IA")
    system_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False, default="claude-sonnet-4-20250514")
    provider = Column(String, nullable=False, default="anthropic")
    temperature = Column(Float, nullable=False, default=0.7)
    max_tokens = Column(Integer, nullable=False, default=1024)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Service(Base):
    __tablename__ = "service"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Barbería, Manicure y Pedicure, Estilismo, Tratamientos Capilares, Facial y Pestañas
    price = Column(Integer, nullable=False)  # COP sin decimales
    duration_minutes = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    staff_ids = Column(JSON, default=list)  # IDs of staff who can perform this service
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointment"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("public.service.id"), nullable=False)
    date = Column(Date, nullable=False)
    time = Column(String, nullable=False)  # HH:MM format
    duration_minutes = Column(Integer, nullable=False)
    price = Column(Integer, nullable=False)  # COP
    status = Column(String, nullable=False, default="confirmed")  # confirmed, completed, cancelled, no_show
    notes = Column(Text, nullable=True)
    created_by = Column(String, nullable=True)  # admin, lina_ia, client
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    staff = relationship("Staff", foreign_keys=[staff_id])
    service = relationship("Service", foreign_keys=[service_id])


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversation"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    wa_contact_phone = Column(String, nullable=False)
    wa_contact_name = Column(String, nullable=True)
    wa_profile_photo_url = Column(Text, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    is_ai_active = Column(Boolean, default=True)
    unread_count = Column(Integer, default=0)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    messages = relationship("WhatsAppMessage", back_populates="conversation", order_by="WhatsAppMessage.created_at.asc()")


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_message"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("public.whatsapp_conversation.id"), nullable=False)
    wa_message_id = Column(String, nullable=True, unique=True)  # WhatsApp message ID from API
    direction = Column(String, nullable=False)  # inbound, outbound
    content = Column(Text, nullable=False)
    message_type = Column(String, nullable=False, default="text")  # text, template, image, audio
    status = Column(String, nullable=False, default="sent")  # sent, delivered, read, failed
    sent_by = Column(String, nullable=True)  # staff name or 'lina_ia' or null (client)
    media_url = Column(Text, nullable=True)  # URL for images, stickers, videos, audio, documents
    media_mime_type = Column(String, nullable=True)  # e.g. image/jpeg, video/mp4, image/webp
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("WhatsAppConversation", back_populates="messages")


class LinaLearning(Base):
    """Global learnings for Lina IA — rules and patterns she must follow.
    These are NOT tied to a specific client. They're general knowledge."""
    __tablename__ = "lina_learning"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, default="general")  # general, rechazos, citas, pagos, quejas, audios, etc.
    original_input = Column(Text, nullable=False)  # What the admin typed
    content = Column(Text, nullable=False)  # Processed/improved by AI
    created_by = Column(String, nullable=True, default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# MULTI-TENANT — Plexify Studio SaaS
# ============================================================================

class Tenant(Base):
    """Each business/agency is a tenant with its own data, config, and limits."""
    __tablename__ = "tenant"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)  # URL-safe identifier
    name = Column(String(200), nullable=False)
    business_type = Column(String(50), nullable=False, default="peluqueria")
    owner_name = Column(String(200), nullable=True)
    owner_phone = Column(String(20), nullable=True)
    owner_email = Column(String(200), nullable=True)

    # WhatsApp config (per-tenant)
    wa_phone_number_id = Column(String(50), nullable=True)
    wa_business_account_id = Column(String(50), nullable=True)
    wa_access_token = Column(Text, nullable=True)
    wa_webhook_token = Column(String(100), nullable=True)
    wa_phone_display = Column(String(20), nullable=True)

    # AI config
    ai_name = Column(String(50), nullable=False, default="Lina")
    ai_personality = Column(Text, nullable=True)
    ai_model = Column(String(100), nullable=False, default="claude-sonnet-4-5-20250929", server_default="claude-sonnet-4-5-20250929")

    # Business info
    timezone = Column(String(50), nullable=False, default="America/Bogota")
    currency = Column(String(10), nullable=False, default="COP")
    booking_url = Column(String(500), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(10), nullable=False, default="CO")

    # Plan & billing
    plan = Column(String(20), nullable=False, default="trial")
    monthly_price = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True)
    ai_is_paused = Column(Boolean, default=False)

    # Message metering
    messages_used = Column(Integer, nullable=False, default=0)
    messages_limit = Column(Integer, nullable=False, default=5000)

    # Meta
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UsageMetrics(Base):
    """Monthly usage tracking per tenant — for billing and monitoring."""
    __tablename__ = "usage_metrics"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    period = Column(String(20), nullable=False)  # "2026-03"
    wa_messages_sent = Column(Integer, nullable=False, default=0)
    wa_messages_received = Column(Integer, nullable=False, default=0)
    ai_tokens_used = Column(Integer, nullable=False, default=0)
    campaigns_sent = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class StaffCommission(Base):
    """Commission configuration per staff member."""
    __tablename__ = "staff_commission"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False, unique=True)
    default_rate = Column(Float, nullable=False, default=0.40)  # e.g. 0.40 = 40%
    service_overrides = Column(JSON, default=dict)  # {service_id: rate}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


class Expense(Base):
    """Business expense tracking."""
    __tablename__ = "expense"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False)  # arriendo, nomina, productos, servicios, marketing, otros
    description = Column(Text, nullable=False)
    amount = Column(Integer, nullable=False)  # COP sin decimales
    date = Column(Date, nullable=False)
    payment_method = Column(String, nullable=True)  # efectivo, transferencia, tarjeta, nequi, daviplata
    receipt_url = Column(Text, nullable=True)
    subcategory = Column(String, nullable=True)
    vendor = Column(String, nullable=True)  # proveedor
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String, nullable=True)  # mensual, semanal, quincenal
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    """Invoice / factura electrónica."""
    __tablename__ = "invoice"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, nullable=False)  # FV-0001
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=True)
    client_document = Column(String, nullable=True)  # CC/NIT
    subtotal = Column(Integer, nullable=False, default=0)
    tax_rate = Column(Float, nullable=False, default=0.19)
    tax_amount = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    payment_method = Column(String, nullable=True)
    status = Column(String, nullable=False, default="draft")  # draft, sent, paid, cancelled
    issued_date = Column(Date, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    """Line item within an invoice."""
    __tablename__ = "invoice_item"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("public.invoice.id"), nullable=False)
    service_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    staff_name = Column(String, nullable=True)
    visit_id = Column(Integer, ForeignKey("public.visit_history.id"), nullable=True)

    invoice = relationship("Invoice", back_populates="items")


class BillingRecord(Base):
    """Invoice/payment record per tenant per period."""
    __tablename__ = "billing_record"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    period = Column(String(20), nullable=False)  # "2026-03"
    amount = Column(Integer, nullable=False, default=0)  # COP
    status = Column(String(20), nullable=False, default="pending")  # pending, paid, overdue
    payment_method = Column(String(50), nullable=True)  # transfer, cash, card
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


# ============================================================================
# CONTENT STUDIO — AI Content Generation & Publishing
# ============================================================================

class GeneratedContent(Base):
    """AI-generated content (images, videos, posts, stories) per tenant."""
    __tablename__ = "generated_content"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    content_type = Column(String, nullable=False)  # 'image', 'video', 'post', 'story'
    title = Column(String, nullable=True)
    prompt = Column(Text, nullable=True)
    caption = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)  # URL of generated media
    thumbnail_url = Column(String, nullable=True)
    style = Column(String, nullable=True)
    dimensions = Column(String, nullable=True)  # '1080x1080', '1080x1920', etc.
    platform = Column(String, nullable=True)  # 'facebook', 'instagram', 'both'
    status = Column(String, default='draft')  # 'draft', 'published', 'scheduled', 'failed'
    scheduled_at = Column(DateTime, nullable=True)
    published_at = Column(DateTime, nullable=True)
    meta_post_id = Column(String, nullable=True)  # ID from Meta API after publishing
    generation_cost = Column(Float, default=0)  # Cost in USD
    metadata_json = Column(Text, nullable=True)  # JSON string for extra data
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class MessageTemplate(Base):
    """WhatsApp message template — stored in DB, synced with Meta approval status.
    These templates are what admins configure in the Plantillas page and what
    Automations reference for sending messages."""
    __tablename__ = "message_template"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    name = Column(String(200), nullable=False)  # Display name: "Recordatorio 24h"
    slug = Column(String(100), nullable=False)  # Meta template name: "recordatorio_24h"
    category = Column(String(50), nullable=False)  # recordatorio, post_servicio, reactivacion, promocion, fidelizacion, bienvenida
    body = Column(Text, nullable=False)  # Message body with {{variables}}
    variables = Column(JSON, default=list)  # ["nombre", "hora", "profesional"]
    status = Column(String(20), nullable=False, default="draft")  # draft, pending, approved, rejected
    language = Column(String(10), nullable=False, default="es")
    times_sent = Column(Integer, default=0)
    response_rate = Column(Float, default=0)
    last_sent_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


# ============================================================================
# AUTOMATED WORKFLOWS — WhatsApp automation engine
# ============================================================================

class WorkflowTemplate(Base):
    """Configurable automated WhatsApp workflow per tenant.
    Each workflow type (reminder, birthday, reactivation, etc.) has its own
    message template, on/off toggle, and execution stats."""
    __tablename__ = "workflow_template"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    workflow_type = Column(String(50), nullable=False)  # reminder_24h, reminder_1h, post_visit, birthday, reactivation, no_show_followup, welcome
    name = Column(String(200), nullable=False)
    icon = Column(String(10), nullable=True)
    color = Column(String(20), nullable=True)
    trigger_description = Column(String(200), nullable=True)
    message_template = Column(Text, nullable=False)  # {{nombre}}, {{hora}}, {{profesional}}, {{servicio}}, {{negocio}}, {{dias}}
    is_enabled = Column(Boolean, default=False)
    config = Column(JSON, default=dict)  # { days: 30 } for reactivation, etc.
    stats_sent = Column(Integer, default=0)
    stats_responded = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class WorkflowExecution(Base):
    """Log of each workflow execution — tracks what was sent to whom."""
    __tablename__ = "workflow_execution"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("public.workflow_template.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("public.appointment.id"), nullable=True)
    phone = Column(String, nullable=False)
    message_sent = Column(Text, nullable=False)
    status = Column(String(20), default="sent")  # sent, delivered, failed, responded
    created_at = Column(DateTime, default=datetime.utcnow)

    workflow = relationship("WorkflowTemplate", foreign_keys=[workflow_id])


class BrandKit(Base):
    """Brand identity configuration per tenant — colors, fonts, tone."""
    __tablename__ = "brand_kits"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False, unique=True)
    logo_url = Column(String, nullable=True)
    primary_color = Column(String, default='#2D5A3D')
    secondary_color = Column(String, default='#1A1A1A')
    accent_color = Column(String, default='#C9A84C')
    font_heading = Column(String, default='Montserrat')
    font_body = Column(String, default='Inter')
    tagline = Column(String, nullable=True)
    tone = Column(String, default='profesional')  # profesional, amigable, divertido, elegante
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    tenant = relationship("Tenant", foreign_keys=[tenant_id])
