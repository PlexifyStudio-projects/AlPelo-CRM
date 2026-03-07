from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.models import Client, VisitHistory, Staff
from schemas import ClientResponse, ClientListResponse


def compute_client_fields(client: Client, db: Session) -> ClientResponse:
    """Compute all calculated fields for a single client response."""
    visits = (
        db.query(VisitHistory)
        .filter(VisitHistory.client_id == client.id)
        .all()
    )

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

    status = _compute_status(total_visits, total_spent, days_since, no_show_count, completed, db, client.status_override)

    barber_name = None
    if client.preferred_barber_id:
        barber = db.query(Staff).filter(Staff.id == client.preferred_barber_id).first()
        if barber:
            barber_name = barber.name

    return ClientResponse(
        id=client.id,
        client_id=client.client_id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        birthday=client.birthday,
        favorite_service=client.favorite_service,
        preferred_barber_id=client.preferred_barber_id,
        preferred_barber_name=barber_name,
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
        status=status,
    )


def compute_client_list_item(client: Client, db: Session) -> ClientListResponse:
    """Lighter version for list endpoints."""
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

    no_show_count = (
        db.query(func.count(VisitHistory.id))
        .filter(VisitHistory.client_id == client.id, VisitHistory.status == "no_show")
        .scalar() or 0
    )

    status = _compute_status(total_visits, total_spent, days_since, no_show_count, None, db, client.status_override)

    return ClientListResponse(
        id=client.id,
        client_id=client.client_id,
        name=client.name,
        phone=client.phone,
        email=client.email,
        is_active=client.is_active,
        tags=client.tags or [],
        total_visits=total_visits,
        total_spent=total_spent,
        avg_ticket=avg_ticket,
        last_visit=last_visit,
        days_since_last_visit=days_since,
        status=status,
    )


def _compute_status(
    total_visits: int,
    total_spent: int,
    days_since: int | None,
    no_show_count: int,
    completed_visits: list | None,
    db: Session,
    status_override: str | None = None,
) -> str:
    """
    Status engine:
    - Manual override takes priority if set
    - VIP: 10+ completed services
    - Nuevo: 0 visits (never came)
    - Activo: <30 days since last visit (and 2+ services)
    - En riesgo: 30-90 days since last visit
    - Inactivo: >90 days since last visit
    - 1 visit + <30 days = nuevo, 1 visit + >=30 days = en_riesgo
    """
    if status_override:
        return status_override

    # Never visited
    if days_since is None:
        return "nuevo"

    # VIP: 10+ completed services
    if total_visits >= 10:
        return "vip"

    # Inactivo: >90 days (takes priority over visit count)
    if days_since > 90:
        return "inactivo"

    # En riesgo: 30-90 days (regardless of visit count)
    if days_since >= 30:
        return "en_riesgo"

    # Under 30 days: nuevo until second service
    if total_visits <= 1:
        return "nuevo"

    # 2+ visits + <30 days = activo
    return "activo"
