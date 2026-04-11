# ============================================================================
# Plexify Studio — Shared helper functions for routes
# Extracted from repeated patterns across ai_endpoints, whatsapp_endpoints, etc.
# ============================================================================

from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database.models import Client, VisitHistory, Staff, WhatsAppConversation, Appointment


# ============================================================================
# TENANT COLUMN CHECK — Cached per-process
# ============================================================================

_TENANT_COLS_READY: bool | None = None


def tenant_cols_ready(db: Session) -> bool:
    """Check (once per process) whether tenant_id columns have been migrated.

    Returns True if the 'staff' table has a 'tenant_id' column in the DB.
    Cached after first call — server restart re-checks.
    """
    global _TENANT_COLS_READY
    if _TENANT_COLS_READY is not None:
        return _TENANT_COLS_READY
    try:
        result = db.execute(
            text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name='staff' AND column_name='tenant_id'"
            )
        )
        _TENANT_COLS_READY = result.fetchone() is not None
    except Exception:
        _TENANT_COLS_READY = False
    return _TENANT_COLS_READY


def safe_tid(user, db: Session):
    """Return user.tenant_id only if the DB columns are migrated, else None."""
    if not tenant_cols_ready(db):
        return None
    return getattr(user, "tenant_id", None)


# ============================================================================
# MULTI-LOCATION — Location helpers
# ============================================================================

_LOCATION_COLS_READY: bool | None = None


def location_cols_ready(db: Session) -> bool:
    """Check if location_id columns are migrated."""
    global _LOCATION_COLS_READY
    if _LOCATION_COLS_READY is not None:
        return _LOCATION_COLS_READY
    try:
        result = db.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='appointment' AND column_name='location_id'"
        ))
        _LOCATION_COLS_READY = result.fetchone() is not None
    except Exception:
        _LOCATION_COLS_READY = False
    return _LOCATION_COLS_READY


def safe_lid(user, db: Session, location_id_param=None):
    """Return location_id for query filtering.
    Priority: explicit param > staff primary_location > None (all locations).
    Returns None if multi-location not active or admin viewing all."""
    if not location_cols_ready(db):
        return None
    if location_id_param is not None:
        if str(location_id_param) == "all" or str(location_id_param) == "":
            return None
        return int(location_id_param)
    # Staff auto-scope to their primary location
    if getattr(user, '_auth_role', '') == 'staff':
        return getattr(user, 'primary_location_id', None)
    return None  # Admin sees all by default


def apply_location_filter(query, model, location_id):
    """Apply location_id filter if provided and model supports it.
    Backward compatible: if location_id is None, no filter applied."""
    if location_id is not None and hasattr(model, 'location_id'):
        return query.filter(model.location_id == location_id)
    return query


# ============================================================================
# COLOMBIA TIMEZONE — Single source of truth (UTC-5)
# ============================================================================

_COL_OFFSET = timedelta(hours=-5)


def now_colombia() -> datetime:
    """Current time in Colombia (UTC-5)."""
    return datetime.utcnow() + _COL_OFFSET


# ============================================================================
# ANTHROPIC API KEY — Read from AIProvider DB first, fallback to env var
# ============================================================================

def get_anthropic_key(db: Session = None) -> tuple[str, str]:
    """Get Anthropic API key and model from AIProvider DB > env var.
    Returns (api_key, model)."""
    import os
    from database.models import AIProvider

    if db:
        try:
            provider = db.query(AIProvider).filter(
                AIProvider.provider_type == "anthropic",
                AIProvider.is_active == True,
            ).order_by(AIProvider.is_primary.desc(), AIProvider.priority.asc()).first()
            if provider and provider.api_key:
                return provider.api_key, provider.model or "claude-sonnet-4-20250514"
        except Exception:
            pass

    return os.getenv("ANTHROPIC_API_KEY", ""), "claude-sonnet-4-20250514"


# ============================================================================
# WHATSAPP TOKEN — Read from tenant DB first, fallback to env var
# ============================================================================

def get_wa_token(db: Session, tenant_id=None) -> str:
    """Get WhatsApp access token: tenant DB > env var."""
    import os
    from database.models import Tenant

    if tenant_id:
        try:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant and tenant.wa_access_token:
                return tenant.wa_access_token
        except Exception:
            pass

    return os.getenv("WHATSAPP_ACCESS_TOKEN", "")


def get_wa_phone_id(db: Session, tenant_id=None) -> str:
    """Get WhatsApp phone number ID: tenant DB > env var."""
    import os
    from database.models import Tenant

    if tenant_id:
        try:
            tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
            if tenant and tenant.wa_phone_number_id:
                return tenant.wa_phone_number_id
        except Exception:
            pass

    return os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")


# ============================================================================
# PHONE NORMALIZATION
# ============================================================================

def normalize_phone(phone: str) -> str:
    """Strip ALL non-digit characters from phone number.
    +57 (314) 708-3182 → 573147083182"""
    import re
    return re.sub(r'\D', '', phone or '')


# ============================================================================
# FIND CLIENT — By client_id, search_name, or phone
# ============================================================================

def _strip_accents(text: str) -> str:
    """Remove accents/diacritics from text for flexible comparison."""
    import unicodedata
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def find_client(db: Session, search_name: str = "", client_id: str = "", phone: str = "", tenant_id=None):
    """Find a client by client_id, name, or phone. Returns first match or None.
    Uses accent-insensitive matching and phone normalization for flexible search.
    When tenant_id is provided, results are scoped to that tenant.
    """
    # 1) Exact client_id match
    if client_id:
        q = db.query(Client).filter(Client.client_id == client_id, Client.is_active == True)
        if tenant_id:
            q = q.filter(Client.tenant_id == tenant_id)
        c = q.first()
        if c:
            return c

    # 2) Search by phone first (most reliable identifier)
    if phone:
        clean = normalize_phone(phone)
        if len(clean) >= 7:
            q = db.query(Client).filter(Client.phone.contains(clean[-10:]), Client.is_active == True)
            if tenant_id:
                q = q.filter(Client.tenant_id == tenant_id)
            c = q.first()
            if c:
                return c

    # 3) Search by name — exact ILIKE first
    if search_name:
        q = db.query(Client).filter(Client.name.ilike(f"%{search_name}%"), Client.is_active == True)
        if tenant_id:
            q = q.filter(Client.tenant_id == tenant_id)
        c = q.first()
        if c:
            return c

        # 4) Accent-insensitive fallback: strip accents and compare in Python
        search_clean = _strip_accents(search_name).lower()
        search_parts = search_clean.split()
        if search_parts:
            # Fetch candidates matching at least the first word (performance filter)
            q = db.query(Client).filter(Client.is_active == True)
            if tenant_id:
                q = q.filter(Client.tenant_id == tenant_id)
            candidates = q.all()
            for candidate in candidates:
                candidate_clean = _strip_accents(candidate.name).lower()
                # Check if all search parts appear in the candidate name
                if all(part in candidate_clean for part in search_parts):
                    return candidate

    return None


# ============================================================================
# FIND CONVERSATION — By name, phone, or client link
# ============================================================================

def find_conversation(db: Session, search_name: str = "", phone: str = "", tenant_id=None):
    """Find a WhatsApp conversation by contact name, linked client name, or phone.
    When tenant_id is provided, results are scoped to that tenant.
    """
    if search_name:
        # Try by conversation contact name
        q = db.query(WhatsAppConversation).filter(
            WhatsAppConversation.wa_contact_name.ilike(f"%{search_name}%")
        )
        if tenant_id:
            q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
        conv = q.first()
        if conv:
            return conv

        # Try by linked CRM client name
        cq = db.query(Client).filter(Client.name.ilike(f"%{search_name}%"))
        if tenant_id:
            cq = cq.filter(Client.tenant_id == tenant_id)
        client = cq.first()
        if client:
            q = db.query(WhatsAppConversation).filter(
                WhatsAppConversation.client_id == client.id
            )
            if tenant_id:
                q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
            conv = q.first()
            if conv:
                return conv
            # Try by client phone in conversation
            if client.phone:
                clean = normalize_phone(client.phone)
                q = db.query(WhatsAppConversation).filter(
                    WhatsAppConversation.wa_contact_phone.contains(clean[-10:])
                )
                if tenant_id:
                    q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
                conv = q.first()
                if conv:
                    return conv

    if phone:
        clean = normalize_phone(phone)
        if len(clean) >= 7:
            q = db.query(WhatsAppConversation).filter(
                WhatsAppConversation.wa_contact_phone.contains(clean[-10:])
            )
            if tenant_id:
                q = q.filter(WhatsAppConversation.tenant_id == tenant_id)
            conv = q.first()
            if conv:
                return conv

    return None


# ============================================================================
# CLIENT STATUS ENGINE
# ============================================================================

def compute_status(
    total_visits: int,
    days_since: int | None,
    status_override: str | None = None,
) -> str:
    """
    Status engine:
    - Manual override takes priority
    - VIP: 10+ completed services
    - Nuevo: 0 visits (never came)
    - Activo: <30 days since last visit (and 2+ services)
    - En riesgo: 30-90 days since last visit
    - Inactivo: >90 days since last visit
    """
    if status_override:
        return status_override
    if days_since is None:
        return "nuevo"
    if total_visits >= 10:
        return "vip"
    if days_since > 90:
        return "inactivo"
    if days_since >= 30:
        return "en_riesgo"
    if total_visits <= 1:
        return "nuevo"
    return "activo"


# ============================================================================
# CLIENT COMPUTED FIELDS — Full detail
# ============================================================================

def compute_client_fields(client: Client, db: Session):
    """Compute all calculated fields for a single client response."""
    from schemas import ClientResponse

    visits = db.query(VisitHistory).filter(VisitHistory.client_id == client.id).all()

    completed = [v for v in visits if v.status == "completed"]
    total_visits = len(completed)
    total_spent = sum(v.amount for v in completed)
    avg_ticket = total_spent // total_visits if total_visits > 0 else 0
    no_show_count = sum(1 for v in visits if v.status == "no_show")

    last_visit = None
    days_since = None
    if completed:
        last_visit = max(v.visit_date for v in completed)
        days_since = (date.today() - last_visit).days

    status = compute_status(total_visits, days_since, client.status_override)

    # Calculate favorite service from visit history (3+ visits with same service)
    from collections import Counter
    favorite_service = None
    preferred_professional = None
    preferred_professional_id = None

    if len(completed) >= 3:
        service_counts = Counter(v.service_name for v in completed if v.service_name)
        if service_counts:
            top_service, top_count = service_counts.most_common(1)[0]
            if top_count >= 3:
                favorite_service = top_service

        staff_counts = Counter(v.staff_id for v in completed if v.staff_id)
        if staff_counts:
            top_staff_id, top_staff_count = staff_counts.most_common(1)[0]
            if top_staff_count >= 3:
                preferred_professional_id = top_staff_id
                staff_obj = db.query(Staff).filter(Staff.id == top_staff_id).first()
                preferred_professional = staff_obj.name if staff_obj else None

    # Get latest visit code from appointments
    last_apt = db.query(Appointment).filter(
        Appointment.client_id == client.id,
        Appointment.visit_code.isnot(None),
        Appointment.visit_code != "",
    ).order_by(Appointment.id.desc()).first()
    last_visit_code = last_apt.visit_code if last_apt else None

    return ClientResponse(
        id=client.id,
        client_id=client.client_id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        document_type=getattr(client, 'document_type', None),
        document_number=getattr(client, 'document_number', None),
        birthday=client.birthday,
        favorite_service=favorite_service,
        preferred_barber_id=preferred_professional_id,
        preferred_barber_name=preferred_professional,
        accepts_whatsapp=client.accepts_whatsapp,
        tags=client.tags or [],
        is_active=client.is_active,
        created_at=client.created_at,
        updated_at=client.updated_at,
        total_visits=total_visits,
        total_spent=total_spent,
        avg_ticket=avg_ticket,
        last_visit=last_visit,
        days_since_last_visit=days_since,
        no_show_count=no_show_count,
        last_visit_code=last_visit_code,
        status=status,
    )


# ============================================================================
# CLIENT COMPUTED FIELDS — Light (for lists)
# ============================================================================

def compute_client_list_item(client: Client, db: Session):
    """Lighter version for list endpoints."""
    from schemas import ClientListResponse

    completed_agg = (
        db.query(
            func.count(VisitHistory.id),
            func.coalesce(func.sum(VisitHistory.amount), 0),
            func.max(VisitHistory.visit_date),
        )
        .filter(VisitHistory.client_id == client.id, VisitHistory.status == "completed")
        .first()
    )

    total_visits = completed_agg[0] or 0
    total_spent = completed_agg[1] or 0
    last_visit = completed_agg[2]
    avg_ticket = total_spent // total_visits if total_visits > 0 else 0

    days_since = None
    if last_visit:
        days_since = (date.today() - last_visit).days

    status = compute_status(total_visits, days_since, client.status_override)

    last_apt = db.query(Appointment).filter(
        Appointment.client_id == client.id,
        Appointment.visit_code.isnot(None),
        Appointment.visit_code != "",
    ).order_by(Appointment.id.desc()).first()
    last_visit_code = last_apt.visit_code if last_apt else None

    return ClientListResponse(
        id=client.id,
        client_id=client.client_id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        document_type=getattr(client, 'document_type', None),
        document_number=getattr(client, 'document_number', None),
        last_visit_code=last_visit_code,
        is_active=client.is_active,
        tags=client.tags or [],
        total_visits=total_visits,
        total_spent=total_spent,
        avg_ticket=avg_ticket,
        last_visit=last_visit,
        days_since_last_visit=days_since,
        status=status,
    )
