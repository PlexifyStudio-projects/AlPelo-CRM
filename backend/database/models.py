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
    active_session_token = Column(Text, nullable=True)  # Single-device session enforcement
    session_started_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    primary_location_id = Column(Integer, nullable=True)  # Multi-location: default sede
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
    photo_url = Column(Text, nullable=True)  # Base64 data URI for staff photo
    username = Column(String, unique=True, index=True, nullable=True)  # login credential (nullable = no login)
    password = Column(String, nullable=True)  # hashed password
    # Bank info for payroll
    document_type = Column(String(5), nullable=True)  # CC, CE, NIT
    document_number = Column(String(200), nullable=True)  # Encrypted
    bank_name = Column(String(100), nullable=True)  # Bancolombia, Davivienda, etc.
    bank_account_type = Column(String(20), nullable=True)  # Ahorros, Corriente
    bank_account_number = Column(String(200), nullable=True)  # Encrypted
    nequi_phone = Column(String(200), nullable=True)  # Encrypted
    daviplata_phone = Column(String(200), nullable=True)  # Encrypted
    preferred_payment_method = Column(String(20), nullable=True)  # nequi, bancolombia, daviplata, efectivo
    bre_b_key = Column(String(200), nullable=True)  # Llave Bre-B (transferencias instantáneas)
    bre_b_key_type = Column(String(20), nullable=True)  # phone | document | email | account
    salary_base = Column(Integer, nullable=True)  # COP — salario base mensual (opcional)
    bookable_online = Column(Boolean, default=True)  # Aparece en booking online
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visits = relationship("VisitHistory", back_populates="staff")


class StaffLoan(Base):
    """Préstamos y abonos a colaboradores (anticipos de nómina)."""
    __tablename__ = "staff_loan"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True, index=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    type = Column(String(15), nullable=False, default='prestamo')  # 'prestamo' | 'abono'
    amount = Column(Integer, nullable=False)  # COP
    date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    status = Column(String(15), nullable=False, default='pendiente')  # 'pendiente' | 'pagado' | 'descontado'
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


class Client(Base):
    __tablename__ = "client"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    client_id = Column(String, unique=True, index=True, nullable=False)  # M20201 format
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    document_type = Column(String, nullable=True)  # CC, CE, TI, NIT, Pasaporte
    document_number = Column(String, nullable=True)
    visit_code = Column(String, nullable=True)  # Ticket assigned at reception
    birthday = Column(Date, nullable=True)
    favorite_service = Column(String, nullable=True)
    preferred_barber_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    accepts_whatsapp = Column(Boolean, default=True)
    tags = Column(JSON, default=list)
    status_override = Column(String, nullable=True)  # manual override: activo, vip, en_riesgo, inactivo, nuevo
    is_active = Column(Boolean, default=True)
    import_batch_id = Column(Integer, ForeignKey("public.import_batch.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferred_barber = relationship("Staff", foreign_keys=[preferred_barber_id])
    visits = relationship("VisitHistory", back_populates="client", order_by="VisitHistory.visit_date.desc()")
    notes = relationship("ClientNote", back_populates="client", order_by="ClientNote.created_at.desc()")
    import_batch = relationship("ImportBatch", foreign_keys=[import_batch_id], back_populates="clients")


class ImportBatch(Base):
    """History of bulk-imported client batches.
    Every CSV/XLSX upload via /clients/import creates one of these so admins
    can see who imported what, when, and review the resulting clients.
    """
    __tablename__ = "import_batch"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    admin_id = Column(Integer, nullable=True)
    admin_name = Column(String, nullable=True)         # snapshot at import time
    filename = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)         # bytes
    total_rows = Column(Integer, nullable=False, default=0)
    imported_count = Column(Integer, nullable=False, default=0)
    skipped_count = Column(Integer, nullable=False, default=0)
    error_count = Column(Integer, nullable=False, default=0)
    error_log = Column(JSON, default=list)             # first ~50 error/skip messages for audit
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    clients = relationship("Client", back_populates="import_batch", foreign_keys="Client.import_batch_id")


class VisitHistory(Base):
    __tablename__ = "visit_history"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)  # Multi-location
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    service_name = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)  # COP sin decimales
    visit_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="completed")  # completed, no_show, cancelled
    payment_method = Column(String, nullable=True)  # efectivo, transferencia, tarjeta, nequi, daviplata
    notes = Column(Text, nullable=True)
    tip = Column(Integer, nullable=False, default=0)  # COP propina asignada a este staff
    is_invoiced = Column(Boolean, default=False)
    payment_id = Column(Integer, ForeignKey("staff_payment.id"), nullable=True)  # Links visit to staff payment
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="visits")
    staff = relationship("Staff", back_populates="visits")
    payment = relationship("StaffPayment", back_populates="visits", foreign_keys=[payment_id])


class ClientNote(Base):
    __tablename__ = "client_note"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String, nullable=True)  # nombre de quien la creo
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="notes")


class AIConfig(Base):
    __tablename__ = "ai_config"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
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
    tenant_id = Column(Integer, nullable=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    service_type = Column(String(20), nullable=False, default='cita')  # cita, paquete, reserva
    price = Column(Integer, nullable=False)  # COP sin decimales
    duration_minutes = Column(Integer, nullable=True)  # Para citas: duración en min. Para paquetes: días de vigencia
    description = Column(Text, nullable=True)
    staff_ids = Column(JSON, default=list)  # IDs of staff who can perform this service
    ai_mode = Column(String(10), nullable=False, default='auto')  # auto = Lina can book, manual = Lina pauses and notifies admin
    is_active = Column(Boolean, default=True)
    photo_url = Column(Text, nullable=True)  # base64 data URI o URL de la imagen del servicio
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StaffServiceCommission(Base):
    """Commission per staff member per service.
    Si commission_type='percentage': commission_rate (0.0 a 1.0) aplica sobre el precio.
    Si commission_type='fixed': commission_amount (COP) es la cantidad exacta a pagar.
    """
    __tablename__ = "staff_service_commission"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("public.service.id"), nullable=False)
    commission_rate = Column(Float, nullable=False, default=0.0)  # 0.0 to 1.0 (si type=percentage)
    commission_type = Column(String(15), nullable=False, default='percentage')  # 'percentage' | 'fixed'
    commission_amount = Column(Integer, nullable=True)  # COP (si type=fixed)
    is_enabled = Column(Boolean, default=True)  # toggle on/off por staff (cuando False no realiza el servicio)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])
    service = relationship("Service", foreign_keys=[service_id])


class ClientSubscription(Base):
    __tablename__ = "client_subscription"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    client_id = Column(Integer, nullable=False)
    service_id = Column(Integer, nullable=True)  # El paquete/membresía comprada
    service_name = Column(String, nullable=False)  # Nombre denormalizado para referencia rápida
    status = Column(String(20), nullable=False, default='active')  # active, expired, cancelled, paused
    purchased_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # null = sin vencimiento
    sessions_total = Column(Integer, nullable=True)  # null = ilimitado (ej: gym mensual)
    sessions_used = Column(Integer, nullable=False, default=0)
    amount_paid = Column(Integer, nullable=False, default=0)  # COP
    payment_method = Column(String(30), nullable=True)  # efectivo, nequi, tarjeta, transferencia
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointment"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)  # Multi-location: which sede
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
    visit_code = Column(String, nullable=True, index=True)  # Ticket assigned at reception
    commission_rate = Column(Float, nullable=True)  # Locked at payment time (0.0 - 1.0)
    commission_amount = Column(Integer, nullable=True)  # Locked: price * commission_rate
    notes = Column(Text, nullable=True)
    staff_payment_id = Column(Integer, ForeignKey("staff_payment.id"), nullable=True)  # Links to payroll payment
    created_by = Column(String, nullable=True)  # admin, lina_ia, client
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    staff = relationship("Staff", foreign_keys=[staff_id])
    service = relationship("Service", foreign_keys=[service_id])


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversation"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)  # Multi-location
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    wa_contact_phone = Column(String, nullable=False)
    wa_contact_name = Column(String, nullable=True)
    wa_profile_photo_url = Column(Text, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    is_ai_active = Column(Boolean, default=True)
    unread_count = Column(Integer, default=0)
    last_sentiment = Column(String, nullable=True)  # sentiment of last inbound message
    tags = Column(JSON, default=list)
    # Transport that owns this conversation: 'meta' (Cloud API) or 'web' (Baileys).
    # Inbox filters by tenant.wa_mode so switching modes shows the right phone's chats.
    transport = Column(String(10), nullable=False, default="meta", server_default="meta")
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
    sentiment = Column(String, nullable=True)  # positive, neutral, negative, urgent (inbound only)
    sentiment_score = Column(Float, nullable=True)  # -1.0 to 1.0
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("WhatsAppConversation", back_populates="messages")


class LinaLearning(Base):
    """Global learnings for Lina IA — rules and patterns she must follow.
    These are NOT tied to a specific client. They're general knowledge."""
    __tablename__ = "lina_learning"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
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
    wa_token_expires_at = Column(DateTime, nullable=True)  # When long-lived token expires

    # WhatsApp transport mode: 'meta' (Cloud API, official) or 'web' (Baileys, unofficial)
    wa_mode = Column(String(10), nullable=False, default="meta", server_default="meta")
    # Web (Baileys) session — populated when wa_mode='web'
    wa_web_session_id = Column(String(80), nullable=True)  # session id in Node service (= "tenant_{id}")
    wa_web_status = Column(String(20), nullable=True)  # disconnected | connecting | qr | connected | banned
    wa_web_phone = Column(String(30), nullable=True)  # phone number once paired (for display)
    wa_web_connected_at = Column(DateTime, nullable=True)
    wa_web_last_qr_at = Column(DateTime, nullable=True)
    wa_web_warmup_started_at = Column(DateTime, nullable=True)  # day 0 of warm-up
    wa_web_daily_limit = Column(Integer, nullable=False, default=20, server_default="20")  # current daily cap
    wa_web_sent_today = Column(Integer, nullable=False, default=0, server_default="0")
    wa_web_sent_today_date = Column(Date, nullable=True)  # date for sent_today counter (resets daily)
    wa_web_pacing_min_seconds = Column(Integer, nullable=False, default=30, server_default="30")
    wa_web_pacing_max_seconds = Column(Integer, nullable=False, default=90, server_default="90")
    wa_web_disclaimer_accepted_at = Column(DateTime, nullable=True)

    # AI config
    ai_name = Column(String(50), nullable=False, default="Lina")
    ai_personality = Column(Text, nullable=True)
    ai_model = Column(String(100), nullable=False, default="claude-sonnet-4-20250514", server_default="claude-sonnet-4-20250514")

    # Google Reviews
    google_review_url = Column(String(500), nullable=True)

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
    paid_until = Column(Date, nullable=True)  # Service paid until this date
    default_tax_rate = Column(Float, nullable=False, default=0)  # 0 = no IVA, 0.19 = 19% IVA
    monthly_revenue_goal = Column(Integer, nullable=False, default=0)  # COP — owner-set monthly revenue target
    # DIAN / Fiscal config
    nit = Column(String(20), nullable=True)  # NIT con dígito verificación: 901234567-8
    legal_name = Column(String(300), nullable=True)  # Razón social
    person_type = Column(String(20), nullable=True)  # natural, juridica
    tax_regime = Column(String(30), nullable=True)  # responsable_iva, no_responsable, rst
    ciiu_code = Column(String(10), nullable=True)  # Actividad económica: 9602
    fiscal_address = Column(Text, nullable=True)
    municipality_code = Column(String(10), nullable=True)  # Código DANE: 68001
    department_code = Column(String(5), nullable=True)  # 68 = Santander
    fiscal_phone = Column(String(30), nullable=True)
    fiscal_email = Column(String(200), nullable=True)
    dian_resolution_number = Column(String(50), nullable=True)
    dian_resolution_date = Column(Date, nullable=True)
    invoice_prefix = Column(String(10), nullable=True)  # FV, PLXF, etc.
    invoice_range_from = Column(Integer, nullable=True)
    invoice_range_to = Column(Integer, nullable=True)
    resolution_valid_from = Column(Date, nullable=True)
    resolution_valid_to = Column(Date, nullable=True)
    billing_provider = Column(String(30), nullable=True)  # dataico, ninguno
    billing_provider_api_key = Column(Text, nullable=True)  # Encrypted
    billing_environment = Column(String(15), nullable=True)  # test, production
    # Wompi / Payment dispersions
    wompi_public_key = Column(String(200), nullable=True)
    wompi_private_key = Column(Text, nullable=True)  # Encrypted
    wompi_events_key = Column(String(200), nullable=True)
    wompi_environment = Column(String(15), nullable=True)  # sandbox, production
    payments_enabled = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    ai_is_paused = Column(Boolean, default=False)

    # Message metering
    messages_used = Column(Integer, nullable=False, default=0)
    messages_limit = Column(Integer, nullable=False, default=1000)

    # Automation limit per plan
    max_automations = Column(Integer, nullable=False, default=10)

    # Google Reviews
    google_review_url = Column(String(500), nullable=True)  # e.g. "https://g.page/r/xxx/review"

    # White-label Branding
    logo_url = Column(Text, nullable=True)  # URL or base64 data URI
    brand_color = Column(String(20), nullable=True)  # Primary color hex e.g. "#2D5A3D"
    brand_color_dark = Column(String(20), nullable=True)  # Dark variant
    brand_color_accent = Column(String(20), nullable=True)  # Accent color
    brand_name = Column(String(200), nullable=True)  # Display name override (e.g. "AlPelo CRM")

    # Public Booking Page
    booking_enabled = Column(Boolean, default=False)
    booking_tagline = Column(String(300), nullable=True)
    booking_description = Column(Text, nullable=True)
    gallery_images = Column(JSON, default=[])
    booking_cover_url = Column(Text, nullable=True)
    booking_phone = Column(String(30), nullable=True)
    booking_whatsapp = Column(String(30), nullable=True)
    booking_instagram = Column(String(500), nullable=True)
    booking_facebook = Column(String(500), nullable=True)
    booking_tags = Column(JSON, default=[])
    booking_schedule = Column(JSON, default=[])
    google_place_id = Column(String(300), nullable=True)
    booking_google_rating = Column(Float, nullable=True)
    booking_google_total_reviews = Column(Integer, nullable=True)
    booking_google_reviews = Column(JSON, default=[])

    # Meta
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# MULTI-LOCATION — Sedes por tenant
# ============================================================================

class Location(Base):
    """A physical location/branch within a tenant (business).
    One tenant can have many locations. Clients are shared; staff, agenda, inventory are per-location."""
    __tablename__ = "location"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), nullable=False)
    address = Column(Text, nullable=True)
    phone = Column(String(30), nullable=True)
    opening_time = Column(String(5), nullable=True, default="08:00")
    closing_time = Column(String(5), nullable=True, default="19:00")
    days_open = Column(JSON, default=list)  # [0,1,2,3,4,5] = Mon-Sat
    wa_phone_number_id = Column(String(50), nullable=True)  # Optional per-location WA number
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class StaffLocation(Base):
    """Many-to-many: staff can work at multiple locations."""
    __tablename__ = "staff_location"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("public.location.id"), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PlatformConfig(Base):
    """Global platform-wide key-value configuration (Meta credentials, etc.).
    NOT per-tenant — these are Plexify Studio's own settings."""
    __tablename__ = "platform_config"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    is_secret = Column(Boolean, default=False)  # Mask in API responses
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
    tenant_id = Column(Integer, nullable=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False, unique=True)
    default_rate = Column(Float, nullable=False, default=0.40)  # e.g. 0.40 = 40%
    service_overrides = Column(JSON, default=dict)  # DEPRECATED: use StaffServiceCommission table instead
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


class Expense(Base):
    """Business expense tracking."""
    __tablename__ = "expense"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    location_id = Column(Integer, nullable=True)  # Multi-location
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
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    """Invoice / factura electrónica."""
    __tablename__ = "invoice"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    invoice_number = Column(String, unique=True, nullable=False)  # FV-0001
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=True)
    client_document = Column(String, nullable=True)  # CC/NIT number
    client_document_type = Column(String(5), nullable=True)  # CC, NIT, CE, TI, Pasaporte, DIE
    client_email = Column(String(200), nullable=True)
    client_address = Column(Text, nullable=True)
    subtotal = Column(Integer, nullable=False, default=0)
    discount_type = Column(String(10), nullable=True)  # percent, fixed
    discount_value = Column(Integer, nullable=False, default=0)  # % or COP amount
    discount_amount = Column(Integer, nullable=False, default=0)  # Calculated COP
    tax_rate = Column(Float, nullable=False, default=0.19)
    tax_amount = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    payment_method = Column(String, nullable=True)
    payment_terms = Column(String(20), nullable=False, default='contado')  # contado, credito
    due_date = Column(Date, nullable=True)  # Only for credito
    status = Column(String, nullable=False, default="draft")  # draft, sent, paid, cancelled
    issued_date = Column(Date, nullable=False)
    paid_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # DIAN POS fields
    pos_number = Column(Integer, nullable=True)  # Consecutivo POS (1, 2, 3... 4000)
    pos_prefix = Column(String(10), nullable=True)  # Prefijo al momento de asignar (POS, FV, PLXF)
    pos_full_number = Column(String(20), nullable=True)  # Numero completo: POS-0001
    is_pos = Column(Boolean, default=False)  # Es factura POS electronica?
    dian_status = Column(String(20), nullable=True)  # pending, sent, accepted, rejected, voided
    cufe = Column(String(200), nullable=True)  # Codigo Unico Factura Electronica
    dian_sent_at = Column(DateTime, nullable=True)
    dian_response = Column(Text, nullable=True)  # JSON respuesta de DIAN/Alegra
    alegra_id = Column(String(50), nullable=True)  # ID en Alegra

    client = relationship("Client", foreign_keys=[client_id])
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    """Line item within an invoice."""
    __tablename__ = "invoice_item"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    invoice_id = Column(Integer, ForeignKey("public.invoice.id"), nullable=False)
    service_id = Column(Integer, nullable=True)
    service_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)
    total = Column(Integer, nullable=False)
    staff_id = Column(Integer, nullable=True)
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
    header_type = Column(String(10), nullable=True)  # IMAGE, VIDEO, TEXT, or null (no header)
    header_media_url = Column(Text, nullable=True)  # base64 data URI or URL for image/video
    header_text = Column(String(200), nullable=True)  # Text header content
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


# ============================================================================
# AUTOMATION STUDIO — User-created automations (replaces hardcoded workflows)
# ============================================================================

class AutomationRule(Base):
    """User-created automation rule. Universal triggers for any business type.
    Replaces the 42 hardcoded WorkflowTemplate functions with a generic engine."""
    __tablename__ = "automation_rule"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    name = Column(String(200), nullable=False)  # "Recordatorio de cita 24h"

    # Trigger: WHEN does it fire?
    trigger_type = Column(String(50), nullable=False)
    # Trigger types: hours_before_appt, hours_after_complete, appointment_created,
    # appointment_cancelled, no_show, days_since_visit, new_client, birthday,
    # visit_milestone, client_anniversary, payment_received, payment_pending
    trigger_config = Column(JSON, nullable=False, default=dict)
    # { "hours": 24, "eval_hour": 10, "days": 30, "milestone": 10 }

    # Filter: WHO receives it?
    filter_config = Column(JSON, nullable=False, default=dict)
    # { "status": ["vip","activo"], "tags": ["premium"], "min_visits": 5,
    #   "min_spend": 100000, "service": "Corte", "accepts_whatsapp": true }

    # Action: WHAT does it do?
    action_type = Column(String(30), nullable=False, default="send_whatsapp")
    # Action types: send_whatsapp, notify_admin, update_tag, create_note
    action_config = Column(JSON, nullable=False, default=dict)
    # { "message": "Hola {{nombre}}...", "template_name": "react_30",
    #   "template_language": "es", "variables": ["nombre","negocio","dias"] }

    # Chain: follow-up if no reply
    chain_config = Column(JSON, nullable=True)
    # { "if_no_reply_days": 3, "then_message": "...", "then_template_name": "..." }

    # Meta approval
    meta_template_name = Column(String(100), nullable=True)
    meta_template_status = Column(String(20), nullable=False, default="draft")
    # draft, pending, approved, rejected

    # Execution control
    is_enabled = Column(Boolean, default=False)
    cooldown_days = Column(Integer, nullable=False, default=1)  # Don't repeat to same client in X days
    max_per_day = Column(Integer, nullable=False, default=20)  # Max sends per day
    eval_hour = Column(Integer, nullable=True)  # Hour to evaluate (null = realtime)

    # Stats
    stats_sent = Column(Integer, default=0)
    stats_responded = Column(Integer, default=0)
    stats_failed = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class AutomationExecution(Base):
    """Log of each automation execution — tracks what was sent to whom."""
    __tablename__ = "automation_execution"

    id = Column(Integer, primary_key=True, index=True)
    automation_id = Column(Integer, ForeignKey("public.automation_rule.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    appointment_id = Column(Integer, ForeignKey("public.appointment.id"), nullable=True)
    phone = Column(String, nullable=False)
    message_sent = Column(Text, nullable=False)
    is_chain = Column(Boolean, default=False)  # True if this is a follow-up chain message
    status = Column(String(20), default="sent")  # sent, delivered, failed, responded
    created_at = Column(DateTime, default=datetime.utcnow)

    automation = relationship("AutomationRule", foreign_keys=[automation_id])


# ============================================================================
# AI MEMORY — Long-term client memory with embeddings (pgvector)
# ============================================================================

class ClientMemory(Base):
    """Permanent memory per client — extracted from conversations by AI.
    Stores preferences, patterns, complaints, and insights that Lina
    remembers forever. Embeddings enable semantic search."""
    __tablename__ = "client_memory"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    memory_type = Column(String(50), nullable=False)  # preference, complaint, pattern, insight, allergy, note
    content = Column(Text, nullable=False)
    embedding = Column(Text, nullable=True)  # JSON array of floats (vector for semantic search)
    source = Column(String(50), default="conversation")  # conversation, admin_note, auto_detected
    confidence = Column(Float, default=1.0)  # 1.0 = confirmed, 0.5 = inferred
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class LinaTask(Base):
    """Background bulk task for Lina IA — processes large operations in batches.
    When Lina detects a bulk operation (e.g. 'create 50 services'), she queues
    it here and the background worker processes 5 items per cycle."""
    __tablename__ = "lina_task"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    task_type = Column(String(50), nullable=False)  # "bulk_create_services", "bulk_create_clients", etc.
    description = Column(Text, nullable=False)  # Human-readable description
    total_items = Column(Integer, nullable=False, default=0)
    completed_items = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="pending")  # pending, running, completed, failed
    payload = Column(Text, nullable=False)  # JSON array of items to create
    result_log = Column(Text, nullable=True)  # JSON array of results
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Notification(Base):
    """Business notifications — new clients, appointments, cancellations, etc."""
    __tablename__ = "notification"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    type = Column(String(50), nullable=False)  # new_client, new_appointment, cancelled, no_show, lina_action, system
    title = Column(String(300), nullable=False)
    detail = Column(Text, nullable=True)
    icon = Column(String(10), nullable=True)  # emoji
    is_read = Column(Boolean, default=False)
    link = Column(String(200), nullable=True)  # e.g. /agenda, /clientes
    created_at = Column(DateTime, default=datetime.utcnow)


class PushSubscription(Base):
    """Web Push subscription per user per device."""
    __tablename__ = "push_subscription"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    user_type = Column(String(10), nullable=False)  # "admin" or "staff"
    user_id = Column(Integer, nullable=False)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth_key = Column(Text, nullable=False)
    user_agent = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LinaActivityEvent(Base):
    """Persistent activity log for Lina IA — survives restarts."""
    __tablename__ = "lina_activity_event"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=True)
    event_type = Column(String(30), nullable=False)  # respuesta, accion, tarea, error, sistema, skip
    description = Column(String(500), nullable=False)
    detail = Column(Text, nullable=True)
    contact_name = Column(String(200), nullable=True)
    conv_id = Column(Integer, nullable=True)
    status = Column(String(20), default="info")  # ok, info, warning, error
    created_at = Column(DateTime, default=datetime.utcnow)


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


class Campaign(Base):
    """Marketing campaign — created by admin, optionally AI-generated copy,
    submitted to Meta for approval, then sent to segmented audience."""
    __tablename__ = "campaign"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    name = Column(String(200), nullable=False)
    campaign_type = Column(String(50))  # recovery, promo, vip, reactivation, followup
    status = Column(String(30), default="draft")  # draft, pending_meta, approved, rejected, sending, sent, paused

    # Copy/template
    message_body = Column(Text)  # the copy with {{variables}}
    meta_template_name = Column(String(100))  # slug for Meta
    meta_template_id = Column(String(100))  # ID from Meta after submit
    meta_status = Column(String(30))  # pending, approved, rejected

    # Segmentation
    segment_filters = Column(JSON, default=dict)  # {"status": "vip", "days_inactive": 30, ...}
    audience_count = Column(Integer, default=0)

    # Stats
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    responded_count = Column(Integer, default=0)

    # AI
    ai_variants = Column(JSON)  # [{"body": "...", "reason": "..."}, ...]

    created_by = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", foreign_keys=[tenant_id])


# ============================================================================
# STAFF SCHEDULE — Working hours per staff member per day of week
# ============================================================================

class StaffSchedule(Base):
    """Weekly working hours for each staff member."""
    __tablename__ = "staff_schedule"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    location_id = Column(Integer, nullable=True)  # Multi-location
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday ... 6=Sunday (Python weekday)
    start_time = Column(String(5), nullable=True)  # "09:00"
    end_time = Column(String(5), nullable=True)  # "19:00"
    break_start = Column(String(5), nullable=True)  # "12:00"
    break_end = Column(String(5), nullable=True)  # "13:00"
    is_working = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


class StaffDayOff(Base):
    """Specific days off for staff (vacations, sick days, etc.)."""
    __tablename__ = "staff_day_off"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    location_id = Column(Integer, nullable=True)  # Multi-location
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


# ============================================================================
# LOYALTY PROGRAM — Points, tiers, transactions
# ============================================================================

class LoyaltyConfig(Base):
    """Per-tenant loyalty program configuration."""
    __tablename__ = "loyalty_config"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False, unique=True)
    points_per_currency = Column(Float, default=1.0)  # points earned per currency_unit spent
    currency_unit = Column(Integer, default=1000)  # e.g., 1 point per $1,000 COP
    tier_bronze_min = Column(Integer, default=0)
    tier_silver_min = Column(Integer, default=100)
    tier_gold_min = Column(Integer, default=500)
    tier_vip_min = Column(Integer, default=1500)
    referral_bonus_referrer = Column(Integer, default=50)
    referral_bonus_referred = Column(Integer, default=25)
    birthday_bonus = Column(Integer, default=100)
    redemption_rate = Column(Float, default=0.1)  # 10 points = 1 currency_unit discount
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoyaltyAccount(Base):
    """Per-client loyalty account with points balance and tier."""
    __tablename__ = "loyalty_account"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    total_points = Column(Integer, default=0)
    available_points = Column(Integer, default=0)
    tier = Column(String(20), default="bronze")  # bronze, silver, gold, vip
    referred_by_client_id = Column(Integer, nullable=True)
    birthday_bonus_year = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LoyaltyTransaction(Base):
    """Audit trail of all points earned/redeemed."""
    __tablename__ = "loyalty_transaction"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    type = Column(String(30), nullable=False)  # earn_visit, earn_referral, earn_birthday, redeem, admin_adjust
    points = Column(Integer, nullable=False)  # positive=earn, negative=redeem
    description = Column(String(500))
    visit_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# REVIEW REQUESTS — Google Reviews pipeline
# ============================================================================

class ReviewRequest(Base):
    """Tracks review solicitations sent to clients after visits."""
    __tablename__ = "review_request"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    appointment_id = Column(Integer, nullable=True)
    status = Column(String(30), default="sent")  # sent, clicked, rated_positive, rated_negative, completed, expired
    rating = Column(Integer, nullable=True)
    feedback_text = Column(Text, nullable=True)
    token = Column(String(100), nullable=True, unique=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    responded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# CHECKOUT / POS — Smart checkout when appointment is completed
# ============================================================================

class Checkout(Base):
    """A completed transaction — created when staff finishes an appointment."""
    __tablename__ = "checkout"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    location_id = Column(Integer, nullable=True)  # Multi-location
    appointment_id = Column(Integer, ForeignKey("public.appointment.id"), nullable=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    client_name = Column(String, nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    staff_name = Column(String, nullable=True)

    # Pricing
    subtotal = Column(Integer, nullable=False, default=0)  # COP sum of items
    discount_type = Column(String(10), nullable=True)  # "percent" or "fixed"
    discount_value = Column(Integer, nullable=False, default=0)  # % or COP amount
    discount_amount = Column(Integer, nullable=False, default=0)  # calculated COP discount
    tip = Column(Integer, nullable=False, default=0)  # COP
    total = Column(Integer, nullable=False, default=0)  # subtotal - discount + tip

    # Payment
    payment_method = Column(String(30), nullable=False, default="efectivo")
    # efectivo, nequi, daviplata, transferencia, tarjeta_debito, tarjeta_credito, mixto
    payment_details = Column(JSON, nullable=True)  # for mixto: [{"method": "efectivo", "amount": 30000}, ...]

    # Status
    status = Column(String(20), nullable=False, default="completed")  # completed, voided, refunded
    notes = Column(Text, nullable=True)
    receipt_sent = Column(Boolean, default=False)  # receipt sent via WhatsApp
    receipt_url = Column(Text, nullable=True)  # base64 data URI of receipt photo/pdf

    # Links
    invoice_id = Column(Integer, ForeignKey("public.invoice.id"), nullable=True)
    visit_id = Column(Integer, nullable=True)

    created_by = Column(String(100), nullable=True)  # admin username or "lina_ia"
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("CheckoutItem", back_populates="checkout", cascade="all, delete-orphan")


class CheckoutItem(Base):
    """Individual item/service in a checkout."""
    __tablename__ = "checkout_item"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    checkout_id = Column(Integer, ForeignKey("public.checkout.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("public.service.id"), nullable=True)
    service_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)  # COP
    total = Column(Integer, nullable=False)  # quantity * unit_price
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    staff_name = Column(String, nullable=True)
    commission_rate = Column(Float, nullable=True)      # Frozen at payment time (0.40 = 40%)
    commission_amount = Column(Integer, nullable=True)  # Frozen COP amount at payment time

    checkout = relationship("Checkout", back_populates="items")


# ============================================================================
# CASH REGISTER — Daily cash management (apertura/cierre)
# ============================================================================

class CashRegister(Base):
    """Daily cash register session — one per day per location."""
    __tablename__ = "cash_register"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("public.tenant.id"), nullable=False)
    location_id = Column(Integer, nullable=True)  # Multi-location
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="open")  # open, closed

    # Opening
    opening_amount = Column(Integer, nullable=False, default=0)  # initial cash
    opened_by = Column(String(100), nullable=True)
    opened_at = Column(DateTime, nullable=True)

    # Closing
    expected_cash = Column(Integer, nullable=False, default=0)  # calculated: opening + cash sales
    counted_cash = Column(Integer, nullable=True)  # actual cash counted
    discrepancy = Column(Integer, nullable=True)  # counted - expected
    closed_by = Column(String(100), nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # Totals (auto-calculated from checkouts)
    total_sales = Column(Integer, nullable=False, default=0)
    total_cash = Column(Integer, nullable=False, default=0)
    total_nequi = Column(Integer, nullable=False, default=0)
    total_daviplata = Column(Integer, nullable=False, default=0)
    total_transfer = Column(Integer, nullable=False, default=0)
    total_card = Column(Integer, nullable=False, default=0)
    total_tips = Column(Integer, nullable=False, default=0)
    total_discounts = Column(Integer, nullable=False, default=0)
    transaction_count = Column(Integer, nullable=False, default=0)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CashMovement(Base):
    """Every cash movement in/out of the register."""
    __tablename__ = "cash_movement"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    movement_type = Column(String(20), nullable=False)  # sale, deposit, withdrawal, expense, adjustment
    amount = Column(Integer, nullable=False)  # positive = in, negative = out
    balance_after = Column(Integer, nullable=False, default=0)
    description = Column(String(300), nullable=False)
    reference_type = Column(String(30), nullable=True)  # checkout, manual, expense, nomina
    reference_id = Column(Integer, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# AI PROVIDER — Multi-provider with failover
# ============================================================================

class AIProvider(Base):
    __tablename__ = "ai_provider"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    provider_type = Column(String(50), nullable=False)  # anthropic, openai, google, etc
    api_key = Column(Text, nullable=False)
    model = Column(String(100), nullable=False)
    priority = Column(Integer, nullable=False, default=1)  # 1 = primary, 2 = fallback, etc
    is_active = Column(Boolean, default=True)
    is_primary = Column(Boolean, default=False)
    status = Column(String(20), default="unknown")  # healthy, degraded, down, unknown
    last_health_check = Column(DateTime, nullable=True)
    input_cost_per_mtok = Column(Float, default=3.0)  # USD per 1M input tokens
    output_cost_per_mtok = Column(Float, default=15.0)  # USD per 1M output tokens
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============================================================================
# DEV PANEL MEGA — Business Prospector + Error Log
# ============================================================================

class BusinessProspect(Base):
    __tablename__ = "business_prospects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    owner_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    business_type = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    ai_analysis = Column(Text, nullable=True)
    why_plexify = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="pending")
    notes = Column(Text, nullable=True)
    source = Column(String(50), nullable=False, default="ai_prospector")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    contacted_at = Column(DateTime, nullable=True)


class ErrorLog(Base):
    __tablename__ = "error_log"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String(255), nullable=True)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    error_type = Column(String(100), nullable=True)
    message = Column(Text, nullable=True)
    traceback_text = Column(Text, nullable=True)
    tenant_id = Column(Integer, nullable=True)
    user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================================================
# INVENTORY — Products & Stock Management
# ============================================================================

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=True)  # Multi-location: stock per sede
    name = Column(String(255), nullable=False)
    sku = Column(String(100), nullable=True)  # Optional product code
    category = Column(String(100), nullable=True)  # e.g. "Cuidado capilar", "Styling", "Skincare"
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False, default=0)  # Selling price
    cost = Column(Float, nullable=False, default=0)   # Purchase cost
    stock = Column(Integer, nullable=False, default=0)
    min_stock = Column(Integer, nullable=False, default=5)  # Alert threshold
    supplier = Column(String(255), nullable=True)
    image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    movements = relationship("InventoryMovement", back_populates="product", lazy="dynamic")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=True)  # Multi-location
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    movement_type = Column(String(20), nullable=False)  # purchase, sale, adjustment, return, loss
    quantity = Column(Integer, nullable=False)  # Positive = stock in, negative = stock out
    unit_cost = Column(Float, nullable=True)  # Cost per unit at time of movement
    note = Column(Text, nullable=True)
    reference_id = Column(Integer, nullable=True)  # Optional link to checkout_id, invoice_id, etc.
    created_by = Column(String(100), nullable=True)  # Username who performed the action
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="movements")


# ============================================================================
# STAFF PAYMENTS — Payroll / Commission Payments
# ============================================================================

class StaffPayment(Base):
    __tablename__ = "staff_payment"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    amount = Column(Integer, nullable=False)  # COP paid
    period_from = Column(Date, nullable=False)
    period_to = Column(Date, nullable=False)
    concept = Column(String(300), nullable=False)  # "Comisiones Semana 1-7 Abr"
    payment_method = Column(String(30), nullable=False)  # efectivo, nequi, bancolombia, daviplata
    reference = Column(String(200), nullable=True)  # transfer number, receipt ref
    receipt_url = Column(Text, nullable=True)  # uploaded proof photo/pdf
    commission_total = Column(Integer, nullable=False, default=0)  # total commissions in period
    tips_total = Column(Integer, nullable=False, default=0)  # total tips in period
    product_commissions = Column(Integer, nullable=False, default=0)  # product sale commissions
    deductions = Column(Integer, nullable=False, default=0)  # advances, penalties, etc
    notes = Column(Text, nullable=True)
    paid_by = Column(String(100), nullable=True)  # admin who made the payment
    paid_at = Column(DateTime, default=datetime.utcnow)
    receipt_number = Column(String(20), nullable=True)  # Auto-generated CP-XXXX
    status = Column(String(20), nullable=False, default='paid')  # paid, pending, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])
    visits = relationship("VisitHistory", back_populates="payment", foreign_keys="VisitHistory.payment_id")


# ============================================================================
# WALK-IN QUEUE — Round-robin staff rotation for walk-in clients
# ============================================================================

class StaffQueue(Base):
    """Staff rotation order for walk-in assignment. Position 1 = next to receive."""
    __tablename__ = "staff_queue"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    is_available = Column(Boolean, default=True)
    walkins_today = Column(Integer, default=0)
    last_walkin_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])


# ============================================================================
# ORDERS — Walk-in / In-process service orders
# ============================================================================

class Order(Base):
    __tablename__ = "order"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    location_id = Column(Integer, nullable=True)
    ticket_number = Column(String(20), nullable=False, index=True)

    # Client info
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    client_name = Column(String(200), nullable=False)
    client_phone = Column(String(30), nullable=True)
    client_email = Column(String(200), nullable=True)
    client_doc_type = Column(String(10), nullable=True)
    client_doc_number = Column(String(30), nullable=True)

    # Staff (assigned later)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)

    # Status
    status = Column(String(20), nullable=False, default="pending")

    # Times
    arrival_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    service_date = Column(Date, nullable=True)  # Date of the service
    service_time = Column(String(5), nullable=True)  # HH:MM of first service slot
    service_start_time = Column(DateTime, nullable=True)
    service_end_time = Column(DateTime, nullable=True)

    # Financials
    subtotal = Column(Integer, nullable=False, default=0)
    discount_type = Column(String(10), nullable=True)
    discount_value = Column(Float, nullable=True)
    discount_amount = Column(Integer, nullable=False, default=0)
    tip = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    payment_method = Column(String(30), nullable=True)
    payment_status = Column(String(15), nullable=False, default="unpaid")
    commission_rate = Column(Float, nullable=True)
    commission_amount = Column(Integer, nullable=True)

    notes = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    products = relationship("OrderProduct", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_item"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    order_id = Column(Integer, ForeignKey("public.order.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("public.service.id"), nullable=True)
    service_name = Column(String(200), nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    price = Column(Integer, nullable=False, default=0)
    duration_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="items")


class OrderProduct(Base):
    __tablename__ = "order_product"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    order_id = Column(Integer, ForeignKey("public.order.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("public.products.id"), nullable=True)
    product_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False, default=0)
    total = Column(Integer, nullable=False, default=0)
    charged_to = Column(String(10), nullable=False, default="client")
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="products")


class StaffFine(Base):
    """Fines/penalties applied to staff members (late arrival, misconduct, etc.)."""
    __tablename__ = "staff_fine"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    reason = Column(String(300), nullable=False)
    amount = Column(Integer, nullable=False, default=0)  # COP
    fine_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)
    is_paid = Column(Boolean, default=False)  # True once deducted from a payment
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    staff = relationship("Staff", foreign_keys=[staff_id])
