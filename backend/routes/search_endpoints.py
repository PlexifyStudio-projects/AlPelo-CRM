from typing import List, Optional
from datetime import datetime, date, timedelta
from collections import Counter

from fastapi import APIRouter, HTTPException, Depends, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, func, or_

from database.connection import get_db
from database.models import (
    Admin, Staff, Client, VisitHistory, ClientNote, Service, Appointment,
    WhatsAppConversation, WhatsAppMessage, Tenant, Expense,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid
from schemas import (
    StaffResponse,
    ClientResponse, ClientListResponse,
    VisitHistoryResponse,
    ClientNoteResponse,
    DashboardKPIs,
    ServiceResponse,
    AppointmentResponse,
    DashboardStatsResponse,
    AppointmentTodayItem,
    PendingTaskItem,
    PaymentAlertItem,
    TopServiceItem,
    FinancialSummaryResponse,
    RevenueDayItem,
    RevenueServiceItem,
    RevenueStaffItem,
    RevenueCategoryItem,
)

router = APIRouter()



# ============================================================================
# STAFF ENDPOINTS
# ============================================================================

@router.get("/staff/")
def list_staff(
    role: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("name"),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = safe_tid(user, db)

    query = db.query(Staff)
    if tid:
        query = query.filter(Staff.tenant_id == tid)

    if active is not None:
        query = query.filter(Staff.is_active == active)

    if role:
        query = query.filter(Staff.role.ilike(f"%{role}%"))

    if skill:
        query = query.filter(cast(Staff.skills, String).ilike(f"%{skill}%"))

    if search:
        term = f"%{search}%"
        query = query.filter(
            Staff.name.ilike(term)
            | Staff.specialty.ilike(term)
            | Staff.role.ilike(term)
            | cast(Staff.skills, String).ilike(term)
        )

    if sort_by == "hire_date":
        query = query.order_by(Staff.hire_date.asc().nullslast())
    elif sort_by == "role":
        query = query.order_by(Staff.role, Staff.name)
    else:
        query = query.order_by(Staff.name)

    staff_list = query.all()

    # Calculate unique client count per staff from appointments
    from sqlalchemy import func as sqlfunc, distinct
    client_counts = {}
    staff_ids = [s.id for s in staff_list]
    if staff_ids:
        count_q = (
            db.query(Appointment.staff_id, sqlfunc.count(distinct(Appointment.client_id)))
            .filter(
                Appointment.staff_id.in_(staff_ids),
                Appointment.status.in_(["completed", "paid"]),
            )
        )
        if tid:
            count_q = count_q.filter(Appointment.tenant_id == tid)
        for staff_id, count in count_q.group_by(Appointment.staff_id).all():
            client_counts[staff_id] = count

    result = []
    for s in staff_list:
        data = StaffResponse.model_validate(s).model_dump()
        data["client_count"] = client_counts.get(s.id, 0)
        result.append(data)

    return result


@router.get("/staff/{staff_id}", response_model=StaffResponse)
def get_staff(staff_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)
    query = db.query(Staff).filter(Staff.id == staff_id)
    if tid:
        query = query.filter(Staff.tenant_id == tid)
    staff = query.first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return StaffResponse.model_validate(staff)


# ============================================================================
# CLIENT ENDPOINTS
# ============================================================================

@router.get("/clients/", response_model=List[ClientListResponse])
def list_clients(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    tag: Optional[str] = Query(None),
    sort_by: Optional[str] = Query("updated_at"),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    from routes._helpers import compute_client_list_item

    tid = safe_tid(user, db)

    query = db.query(Client)
    if tid:
        query = query.filter(Client.tenant_id == tid)

    if active is not None:
        query = query.filter(Client.is_active == active)

    if search:
        term = f"%{search}%"
        digits = ''.join(c for c in search if c.isdigit())
        conditions = [
            Client.name.ilike(term),
            Client.email.ilike(term),
            Client.client_id.ilike(term),
        ]
        if digits:
            conditions.append(func.replace(func.replace(func.replace(func.replace(func.replace(
                func.coalesce(Client.phone, ''), '+', ''), ' ', ''), '(', ''), ')', ''), '-', '').ilike(f"%{digits}%"))
        else:
            conditions.append(Client.phone.ilike(term))
        query = query.filter(or_(*conditions))

    if tag:
        query = query.filter(cast(Client.tags, String).ilike(f"%{tag}%"))

    if sort_by == "updated_at":
        query = query.order_by(Client.updated_at.desc().nullslast())
    elif sort_by == "created_at":
        query = query.order_by(Client.created_at.desc())
    elif sort_by == "client_id":
        query = query.order_by(Client.client_id)
    else:
        query = query.order_by(Client.name)

    clients = query.all()
    result = [compute_client_list_item(c, db) for c in clients]

    # Filter by computed status if requested
    if status:
        result = [c for c in result if c.status == status]

    return result


@router.get("/clients/{client_id}", response_model=ClientResponse)
def get_client(client_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from routes._helpers import compute_client_fields

    tid = safe_tid(user, db)

    query = db.query(Client).filter(Client.id == client_id)
    if tid:
        query = query.filter(Client.tenant_id == tid)
    client = query.first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return compute_client_fields(client, db)


# ============================================================================
# VISIT HISTORY ENDPOINTS
# ============================================================================

@router.get("/clients/{client_id}/visits/", response_model=List[VisitHistoryResponse])
def list_client_visits(
    client_id: int,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = safe_tid(user, db)

    client_q = db.query(Client).filter(Client.id == client_id)
    if tid:
        client_q = client_q.filter(Client.tenant_id == tid)
    client = client_q.first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    query = (
        db.query(VisitHistory)
        .filter(VisitHistory.client_id == client_id)
    )
    if tid:
        query = query.filter(VisitHistory.tenant_id == tid)
    query = query.order_by(VisitHistory.visit_date.desc())

    if status:
        query = query.filter(VisitHistory.status == status)

    visits = query.all()
    result = []
    for v in visits:
        staff = db.query(Staff).filter(Staff.id == v.staff_id).first()
        result.append(VisitHistoryResponse(
            **{c.name: getattr(v, c.name) for c in v.__table__.columns},
            staff_name=staff.name if staff else None,
        ))

    return result


@router.get("/visits/{visit_id}", response_model=VisitHistoryResponse)
def get_visit(visit_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)

    query = db.query(VisitHistory).filter(VisitHistory.id == visit_id)
    if tid:
        query = query.filter(VisitHistory.tenant_id == tid)
    visit = query.first()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    staff = db.query(Staff).filter(Staff.id == visit.staff_id).first()
    return VisitHistoryResponse(
        **{c.name: getattr(visit, c.name) for c in visit.__table__.columns},
        staff_name=staff.name if staff else None,
    )


# ============================================================================
# CLIENT NOTE ENDPOINTS
# ============================================================================

@router.get("/clients/{client_id}/notes/", response_model=List[ClientNoteResponse])
def list_client_notes(client_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)

    client_q = db.query(Client).filter(Client.id == client_id)
    if tid:
        client_q = client_q.filter(Client.tenant_id == tid)
    client = client_q.first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    query = (
        db.query(ClientNote)
        .filter(ClientNote.client_id == client_id)
    )
    if tid:
        query = query.filter(ClientNote.tenant_id == tid)
    notes = query.order_by(ClientNote.created_at.desc()).all()

    return [ClientNoteResponse.model_validate(n) for n in notes]


# ============================================================================
# DASHBOARD KPIs
# ============================================================================

@router.get("/dashboard/kpis", response_model=DashboardKPIs)
def get_dashboard_kpis(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from routes._helpers import compute_client_list_item

    tid = safe_tid(user, db)

    query = db.query(Client).filter(Client.is_active == True)
    if tid:
        query = query.filter(Client.tenant_id == tid)
    clients = query.all()
    enriched = [compute_client_list_item(c, db) for c in clients]

    total = len(enriched)
    active = sum(1 for c in enriched if c.status == "activo")
    vip = sum(1 for c in enriched if c.status == "vip")
    nuevo = sum(1 for c in enriched if c.status == "nuevo")
    at_risk = sum(1 for c in enriched if c.status == "en_riesgo")
    inactive = sum(1 for c in enriched if c.status == "inactivo")

    total_revenue = sum(c.total_spent for c in enriched)
    clients_with_visits = [c for c in enriched if c.total_visits > 0]
    avg_ticket = (
        total_revenue // len(clients_with_visits) if clients_with_visits else 0
    )

    active_count = active + vip
    retention_rate = (active_count / total * 100) if total > 0 else 0

    return DashboardKPIs(
        total_clients=total,
        active_clients=active,
        at_risk_clients=at_risk,
        inactive_clients=inactive,
        vip_clients=vip,
        new_clients=nuevo,
        retention_rate=round(retention_rate, 1),
        total_revenue=total_revenue,
        avg_ticket=avg_ticket,
    )


# ============================================================================
# RFM SEGMENTATION
# ============================================================================

RFM_SEGMENTS = {
    # (R_high, F_high, M_high) → segment
    (True, True, True): "vip",
    (True, True, False): "leal",
    (True, False, True): "potencial",
    (True, False, False): "reciente",
    (False, True, True): "prioritario",
    (False, True, False): "frecuente",
    (False, False, True): "valioso",
    (False, False, False): "inactivo",
}

RFM_META = {
    "vip":         {"label": "VIP", "color": "#8B5CF6", "desc": "Frecuente, reciente, alto gasto"},
    "leal":        {"label": "Leal", "color": "#3B82F6", "desc": "Viene seguido y hace poco"},
    "potencial":   {"label": "Potencial", "color": "#10B981", "desc": "Gasto alto, puede ser mas frecuente"},
    "reciente":    {"label": "Reciente", "color": "#06B6D4", "desc": "Visito hace poco, en crecimiento"},
    "prioritario": {"label": "Prioritario", "color": "#F59E0B", "desc": "Frecuente y valioso, pero lleva tiempo sin venir"},
    "frecuente":   {"label": "Frecuente", "color": "#64748B", "desc": "Viene seguido pero gasto bajo"},
    "valioso":     {"label": "Valioso", "color": "#D97706", "desc": "Gasto alto pero lleva tiempo sin venir"},
    "inactivo":    {"label": "Inactivo", "color": "#94A3B8", "desc": "Bajo en las 3 metricas"},
    "nuevo":       {"label": "Nuevo", "color": "#22C55E", "desc": "Sin historial suficiente"},
}


@router.get("/clients/rfm")
def get_clients_rfm(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Calculate RFM scores for all clients. Returns segmented list."""
    tid = safe_tid(user, db)

    query = db.query(Client).filter(Client.is_active == True)
    if tid:
        query = query.filter(Client.tenant_id == tid)
    clients = query.all()

    now = date.today()
    results = []

    # Gather all visit data in bulk for performance
    all_visits = {}
    visit_query = db.query(
        VisitHistory.client_id,
        func.count(VisitHistory.id).label("total_visits"),
        func.coalesce(func.sum(VisitHistory.amount), 0).label("total_spent"),
        func.max(VisitHistory.visit_date).label("last_visit"),
    ).filter(VisitHistory.status == "completed")
    if tid:
        visit_query = visit_query.filter(VisitHistory.tenant_id == tid)
    visit_query = visit_query.group_by(VisitHistory.client_id)

    for row in visit_query.all():
        all_visits[row.client_id] = {
            "total_visits": row.total_visits,
            "total_spent": row.total_spent,
            "last_visit": row.last_visit,
        }

    # Calculate R, F, M values for each client
    raw_data = []
    for c in clients:
        v = all_visits.get(c.id, {})
        visits = v.get("total_visits", 0)
        spent = v.get("total_spent", 0)
        last = v.get("last_visit")
        days_since = (now - last).days if last else 999

        raw_data.append({
            "client_id": c.id,
            "client_code": c.client_id,
            "name": c.name,
            "phone": c.phone,
            "recency": days_since,
            "frequency": visits,
            "monetary": spent,
            "last_visit": last.isoformat() if last else None,
        })

    if not raw_data:
        return {"clients": [], "segments": RFM_META, "summary": {}}

    # Calculate percentile thresholds (median-based for small datasets)
    recencies = sorted([d["recency"] for d in raw_data])
    frequencies = sorted([d["frequency"] for d in raw_data])
    monetaries = sorted([d["monetary"] for d in raw_data])

    r_median = recencies[len(recencies) // 2] if recencies else 30
    f_median = max(frequencies[len(frequencies) // 2], 1) if frequencies else 2
    m_median = max(monetaries[len(monetaries) // 2], 1) if monetaries else 50000

    # Assign segments
    segment_counts = {}
    for d in raw_data:
        if d["frequency"] == 0:
            segment = "nuevo"
        else:
            r_high = d["recency"] <= r_median  # Lower recency = better (came recently)
            f_high = d["frequency"] >= f_median
            m_high = d["monetary"] >= m_median
            segment = RFM_SEGMENTS.get((r_high, f_high, m_high), "inactivo")

        d["segment"] = segment
        d["segment_label"] = RFM_META[segment]["label"]
        d["segment_color"] = RFM_META[segment]["color"]
        segment_counts[segment] = segment_counts.get(segment, 0) + 1

    # Sort: VIP first, then by monetary desc
    segment_order = ["vip", "leal", "potencial", "prioritario", "valioso", "reciente", "frecuente", "nuevo", "inactivo"]
    raw_data.sort(key=lambda x: (segment_order.index(x["segment"]) if x["segment"] in segment_order else 99, -x["monetary"]))

    return {
        "clients": raw_data,
        "segments": RFM_META,
        "summary": segment_counts,
        "thresholds": {
            "recency_median_days": r_median,
            "frequency_median": f_median,
            "monetary_median": m_median,
        },
    }


# ============================================================================
# SERVICE ENDPOINTS
# ============================================================================

@router.get("/services/", response_model=List[ServiceResponse])
def list_services(
    category: Optional[str] = Query(None),
    active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = safe_tid(user, db)

    query = db.query(Service)
    if tid:
        query = query.filter(Service.tenant_id == tid)

    if active is not None:
        query = query.filter(Service.is_active == active)

    if category:
        query = query.filter(Service.category.ilike(f"%{category}%"))

    if search:
        term = f"%{search}%"
        query = query.filter(
            Service.name.ilike(term) | Service.category.ilike(term)
        )

    services = query.order_by(Service.category, Service.name).all()

    # Batch-load staff names
    all_staff_ids = set()
    for s in services:
        if s.staff_ids:
            all_staff_ids.update(s.staff_ids)

    staff_map = {}
    if all_staff_ids:
        staff_list = db.query(Staff).filter(Staff.id.in_(all_staff_ids)).all()
        staff_map = {s.id: s.name for s in staff_list}

    result = []
    for s in services:
        names = [staff_map[sid] for sid in (s.staff_ids or []) if sid in staff_map]
        result.append(ServiceResponse(
            **{c.name: getattr(s, c.name) for c in s.__table__.columns},
            staff_names=names,
        ))

    return result


# ============================================================================
# COMMISSION ENDPOINTS — must be BEFORE {service_id} routes
# ============================================================================

@router.get("/services/all-commissions")
def get_all_commissions(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Get ALL commission rates for all staff x service combinations."""
    from database.models import StaffServiceCommission
    tid = safe_tid(user, db)
    q = db.query(StaffServiceCommission)
    if tid:
        q = q.filter(StaffServiceCommission.tenant_id == tid)
    all_comms = q.all()
    result = {}
    for c in all_comms:
        result[f"{c.staff_id}-{c.service_id}"] = c.commission_rate or 0
    return {"rates": result}


@router.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)

    query = db.query(Service).filter(Service.id == service_id)
    if tid:
        query = query.filter(Service.tenant_id == tid)
    service = query.first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    staff_names = []
    if service.staff_ids:
        staff_list = db.query(Staff).filter(Staff.id.in_(service.staff_ids)).all()
        staff_names = [s.name for s in staff_list]

    return ServiceResponse(
        **{c.name: getattr(service, c.name) for c in service.__table__.columns},
        staff_names=staff_names,
    )


@router.get("/services/{service_id}/commissions")
def get_service_commissions(service_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Get commission rates for all staff assigned to this service."""
    from database.models import StaffServiceCommission
    tid = safe_tid(user, db)

    service = db.query(Service).filter(Service.id == service_id)
    if tid:
        service = service.filter(Service.tenant_id == tid)
    service = service.first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Get existing commissions
    commissions = db.query(StaffServiceCommission).filter(
        StaffServiceCommission.service_id == service_id
    )
    if tid:
        commissions = commissions.filter(StaffServiceCommission.tenant_id == tid)
    commissions = commissions.all()
    commission_map = {c.staff_id: c.commission_rate for c in commissions}

    # Build response: staff_ids + any staff with existing commission config
    staff_ids = set(service.staff_ids or [])
    staff_ids.update(commission_map.keys())
    staff_list = db.query(Staff).filter(Staff.id.in_(staff_ids)).all() if staff_ids else []

    return {
        "service_id": service_id,
        "service_name": service.name,
        "service_price": service.price,
        "commissions": [
            {
                "staff_id": s.id,
                "staff_name": s.name,
                "commission_rate": commission_map.get(s.id, 0.0),
                "commission_amount": int(service.price * commission_map.get(s.id, 0.0)),
            }
            for s in staff_list
        ],
    }


@router.put("/services/{service_id}/commissions")
def update_service_commissions(service_id: int, data: list = Body(...), db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Update commission rates for staff on this service. data = [{staff_id, commission_rate}, ...]"""
    from database.models import StaffServiceCommission
    tid = safe_tid(user, db)

    service = db.query(Service).filter(Service.id == service_id)
    if tid:
        service = service.filter(Service.tenant_id == tid)
    service = service.first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    for item in data:
        staff_id = item.get("staff_id")
        rate = item.get("commission_rate", 0.0)
        if staff_id is None:
            continue
        rate = max(0.0, min(1.0, float(rate)))

        existing = db.query(StaffServiceCommission).filter(
            StaffServiceCommission.staff_id == staff_id,
            StaffServiceCommission.service_id == service_id,
        )
        if tid:
            existing = existing.filter(StaffServiceCommission.tenant_id == tid)
        existing = existing.first()

        if existing:
            existing.commission_rate = rate
            existing.updated_at = datetime.utcnow()
        else:
            db.add(StaffServiceCommission(
                tenant_id=tid,
                staff_id=staff_id,
                service_id=service_id,
                commission_rate=rate,
            ))

    db.commit()
    return {"status": "ok", "updated": len(data)}


# ============================================================================
# APPOINTMENT ENDPOINTS
# ============================================================================

@router.get("/appointments/", response_model=List[AppointmentResponse])
def list_appointments(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    staff_id: Optional[int] = Query(None),
    client_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    from datetime import date as dt_date

    tid = safe_tid(user, db)

    query = db.query(Appointment)
    if tid:
        query = query.filter(Appointment.tenant_id == tid)

    if search:
        term = f"%{search}%"
        digits = ''.join(c for c in search if c.isdigit())
        is_phone_search = len(digits) >= 7  # Phone numbers have 7+ digits

        if is_phone_search:
            # Phone search: find clients by phone ONLY, don't mix with name matches
            client_q = db.query(Client.id, Client.phone)
            if tid:
                client_q = client_q.filter(Client.tenant_id == tid)
            phone_ids = [
                cid for cid, phone in client_q.all()
                if phone and digits in ''.join(c for c in phone if c.isdigit())
            ]
            if phone_ids:
                query = query.filter(Appointment.client_id.in_(phone_ids))
            else:
                query = query.filter(Appointment.id == -1)  # No results
        else:
            # Text search: name, visit_code, or short phone digits
            conditions = [
                Appointment.client_name.ilike(term),
                Appointment.visit_code.ilike(term),
            ]
            if digits:
                conditions.append(Appointment.visit_code.ilike(f"%{digits}%"))
            if digits and len(digits) >= 4:
                client_q = db.query(Client.id, Client.phone)
                if tid:
                    client_q = client_q.filter(Client.tenant_id == tid)
                phone_ids = [
                    cid for cid, phone in client_q.all()
                    if phone and digits in ''.join(c for c in phone if c.isdigit())
                ]
                if phone_ids:
                    conditions.append(Appointment.client_id.in_(phone_ids))
            else:
                conditions.append(Appointment.client_phone.ilike(term))
            query = query.filter(or_(*conditions))

    if date_from:
        query = query.filter(Appointment.date >= dt_date.fromisoformat(date_from))
    if date_to:
        query = query.filter(Appointment.date <= dt_date.fromisoformat(date_to))
    if staff_id:
        query = query.filter(Appointment.staff_id == staff_id)
    if client_id:
        query = query.filter(Appointment.client_id == client_id)
    if status:
        query = query.filter(Appointment.status == status)

    if search and not date_from and not date_to:
        # When searching without date range, limit to last 60 days + future to avoid flooding
        from datetime import timedelta as _td_search
        _search_start = dt_date.today() - _td_search(days=60)
        query = query.filter(Appointment.date >= _search_start)
        query = query.order_by(Appointment.date.desc(), Appointment.time.desc())
        appointments = query.limit(20).all()
    else:
        appointments = query.order_by(Appointment.date, Appointment.time).all()

    result = []
    staff_cache = {}
    service_cache = {}

    for a in appointments:
        if a.staff_id not in staff_cache:
            staff = db.query(Staff).filter(Staff.id == a.staff_id).first()
            staff_cache[a.staff_id] = staff.name if staff else None
        if a.service_id not in service_cache:
            svc = db.query(Service).filter(Service.id == a.service_id).first()
            service_cache[a.service_id] = svc.name if svc else None

        # Build response — filter to only fields in AppointmentResponse
        apt_data = {}
        for c in a.__table__.columns:
            if hasattr(AppointmentResponse, c.name) or c.name in AppointmentResponse.model_fields:
                apt_data[c.name] = getattr(a, c.name)
        apt_data["staff_name"] = staff_cache.get(a.staff_id)
        apt_data["service_name"] = service_cache.get(a.service_id)
        result.append(AppointmentResponse(**apt_data))

    return result


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(appointment_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)

    query = db.query(Appointment).filter(Appointment.id == appointment_id)
    if tid:
        query = query.filter(Appointment.tenant_id == tid)
    appointment = query.first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    staff = db.query(Staff).filter(Staff.id == appointment.staff_id).first()
    service = db.query(Service).filter(Service.id == appointment.service_id).first()

    return AppointmentResponse(
        **{c.name: getattr(appointment, c.name) for c in appointment.__table__.columns},
        staff_name=staff.name if staff else None,
        service_name=service.name if service else None,
    )


# ============================================================================
# DASHBOARD STATS (comprehensive)
# ============================================================================

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    from routes._helpers import compute_client_list_item

    tid = safe_tid(user, db)

    today = datetime.utcnow().date()
    week_start = today - timedelta(days=today.weekday())
    month_start = date(today.year, today.month, 1)

    # ---------- Client metrics ----------
    client_q = db.query(Client).filter(Client.is_active == True)
    if tid:
        client_q = client_q.filter(Client.tenant_id == tid)
    clients = client_q.all()
    enriched = [compute_client_list_item(c, db) for c in clients]

    total_clients = len(enriched)
    active_clients = sum(1 for c in enriched if c.status == "activo")
    vip_clients = sum(1 for c in enriched if c.status == "vip")
    at_risk_clients = sum(1 for c in enriched if c.status == "en_riesgo")

    # New clients this month
    new_q = (
        db.query(func.count(Client.id))
        .filter(Client.is_active == True)
        .filter(func.date(Client.created_at) >= month_start)
    )
    if tid:
        new_q = new_q.filter(Client.tenant_id == tid)
    new_clients_this_month = new_q.scalar() or 0

    # ---------- Today's appointments ----------
    appt_q = (
        db.query(Appointment)
        .filter(Appointment.date == today)
    )
    if tid:
        appt_q = appt_q.filter(Appointment.tenant_id == tid)
    today_appointments = appt_q.order_by(Appointment.time).all()

    staff_cache = {}
    service_cache = {}
    appointments_today_list = []
    for a in today_appointments:
        if a.staff_id not in staff_cache:
            s = db.query(Staff).filter(Staff.id == a.staff_id).first()
            staff_cache[a.staff_id] = s.name if s else None
        if a.service_id not in service_cache:
            svc = db.query(Service).filter(Service.id == a.service_id).first()
            service_cache[a.service_id] = svc.name if svc else None

        # Calculate no-show risk for each appointment
        _ns_risk = 0
        try:
            from client_intelligence import calculate_noshow_risk
            _ns_data = calculate_noshow_risk(a.id, db=db)
            _ns_risk = _ns_data.get("risk_score", 0)
        except Exception:
            pass

        appointments_today_list.append(AppointmentTodayItem(
            id=a.id,
            time=a.time,
            client_name=a.client_name,
            service_name=service_cache.get(a.service_id),
            staff_name=staff_cache.get(a.staff_id),
            status=a.status,
            noshow_risk=_ns_risk,
        ))

    completed_today = sum(1 for a in today_appointments if a.status in ("completed", "paid"))

    # ---------- Revenue (from VisitHistory — same source as Finances page) ----------
    def revenue_in_range(start_date, end_date):
        rq = (
            db.query(func.coalesce(func.sum(VisitHistory.amount), 0))
            .filter(VisitHistory.status == "completed")
            .filter(VisitHistory.visit_date >= start_date)
            .filter(VisitHistory.visit_date <= end_date)
        )
        if tid:
            rq = rq.filter(VisitHistory.tenant_id == tid)
        result = rq.scalar()
        return result or 0

    revenue_today = revenue_in_range(today, today)
    revenue_this_week = revenue_in_range(week_start, today)
    revenue_this_month = revenue_in_range(month_start, today)

    # ---------- WhatsApp ----------
    today_start_dt = datetime.combine(today, datetime.min.time())
    today_end_dt = datetime.combine(today, datetime.max.time())

    wa_msg_q = (
        db.query(func.count(WhatsAppMessage.id))
        .filter(WhatsAppMessage.direction == "outbound")
        .filter(WhatsAppMessage.sent_by.like("lina_ia%"))
        .filter(WhatsAppMessage.created_at >= today_start_dt)
        .filter(WhatsAppMessage.created_at <= today_end_dt)
    )
    # WhatsAppMessage doesn't have tenant_id — filter through conversation join if needed
    if tid:
        wa_msg_q = wa_msg_q.join(WhatsAppConversation, WhatsAppMessage.conversation_id == WhatsAppConversation.id).filter(WhatsAppConversation.tenant_id == tid)
    whatsapp_messages_today = wa_msg_q.scalar() or 0

    wa_active_q = (
        db.query(func.count(WhatsAppConversation.id))
        .filter(WhatsAppConversation.is_ai_active == True)
    )
    if tid:
        wa_active_q = wa_active_q.filter(WhatsAppConversation.tenant_id == tid)
    whatsapp_active_conversations = wa_active_q.scalar() or 0

    wa_total_q = db.query(func.count(WhatsAppConversation.id))
    if tid:
        wa_total_q = wa_total_q.filter(WhatsAppConversation.tenant_id == tid)
    whatsapp_total_conversations = wa_total_q.scalar() or 0

    wa_unread_q = db.query(func.coalesce(func.sum(WhatsAppConversation.unread_count), 0))
    if tid:
        wa_unread_q = wa_unread_q.filter(WhatsAppConversation.tenant_id == tid)
    whatsapp_unread = wa_unread_q.scalar() or 0

    # ---------- Lina ----------
    # Active = tenant not paused by support AND at least one conversation has AI on
    # When toggle-all-ai sets all convos to off, active_conversations = 0 → inactive
    # When no conversations exist yet, inactive (nothing to respond to)
    _tenant_blocked = False
    if tid:
        _t = db.query(Tenant).filter(Tenant.id == tid).first()
        _tenant_blocked = _t.ai_is_paused if _t else False

    if _tenant_blocked:
        lina_is_global_active = False
    elif whatsapp_total_conversations == 0:
        # No conversations yet — check if any conversation would default to AI on
        # For now, show as inactive since there's nothing to respond to
        lina_is_global_active = False
    else:
        lina_is_global_active = whatsapp_active_conversations > 0

    lina_messages_today = whatsapp_messages_today  # same query: outbound by lina_ia today

    lina_q = (
        db.query(func.count(ClientNote.id))
        .filter(ClientNote.created_by == "lina_ia")
        .filter(ClientNote.created_at >= today_start_dt)
        .filter(ClientNote.created_at <= today_end_dt)
    )
    if tid:
        lina_q = lina_q.filter(ClientNote.tenant_id == tid)
    lina_actions_today = lina_q.scalar() or 0

    # ---------- Pending tasks (pending + recently completed) ----------
    # Pending tasks (PENDIENTE/RECORDATORIO but not resolved)
    from sqlalchemy import or_
    pn_q = (
        db.query(ClientNote)
        .filter(or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")))
        .filter(~ClientNote.content.ilike("%RESUELTO:%"))
        .filter(~ClientNote.content.ilike("%COMPLETADO:%"))
        .filter(~ClientNote.content.ilike("%EXPIRADO:%"))
        .filter(~ClientNote.content.ilike("%FALLIDO:%"))
    )
    if tid:
        pn_q = pn_q.filter(ClientNote.tenant_id == tid)
    pending_notes = (
        pn_q.order_by(ClientNote.created_at.desc())
        .limit(20)
        .all()
    )

    # Recently resolved tasks (last 24h) — show as completed/strikethrough
    recent_cutoff = datetime.utcnow() - timedelta(hours=24)
    rn_q = (
        db.query(ClientNote)
        .filter(
            ClientNote.content.ilike("%RESUELTO:%") |
            ClientNote.content.ilike("%COMPLETADO:%")
        )
        .filter(ClientNote.created_at >= recent_cutoff)
    )
    if tid:
        rn_q = rn_q.filter(ClientNote.tenant_id == tid)
    resolved_notes = (
        rn_q.order_by(ClientNote.created_at.desc())
        .limit(10)
        .all()
    )

    en_q = (
        db.query(ClientNote)
        .filter(ClientNote.content.ilike("%EXPIRADO:%"))
        .filter(ClientNote.created_at >= recent_cutoff)
    )
    if tid:
        en_q = en_q.filter(ClientNote.tenant_id == tid)
    expired_notes = (
        en_q.order_by(ClientNote.created_at.desc())
        .limit(5)
        .all()
    )

    client_cache = {}
    pending_tasks = []

    def _get_client_name(cid):
        if cid not in client_cache:
            cl = db.query(Client).filter(Client.id == cid).first()
            client_cache[cid] = cl.name if cl else "Desconocido"
        return client_cache[cid]

    for n in pending_notes:
        pending_tasks.append(PendingTaskItem(
            id=n.id, client_id=n.client_id,
            client_name=_get_client_name(n.client_id),
            content=n.content, status="pending", created_at=n.created_at,
        ))
    for n in resolved_notes:
        pending_tasks.append(PendingTaskItem(
            id=n.id, client_id=n.client_id,
            client_name=_get_client_name(n.client_id),
            content=n.content, status="completed", created_at=n.created_at,
        ))
    for n in expired_notes:
        pending_tasks.append(PendingTaskItem(
            id=n.id, client_id=n.client_id,
            client_name=_get_client_name(n.client_id),
            content=n.content, status="expired", created_at=n.created_at,
        ))

    # ---------- Payment alerts ----------
    pa_q = (
        db.query(WhatsAppConversation)
        .filter(cast(WhatsAppConversation.tags, String).ilike('%Pago pendiente%'))
    )
    if tid:
        pa_q = pa_q.filter(WhatsAppConversation.tenant_id == tid)
    payment_convs = pa_q.order_by(WhatsAppConversation.last_message_at.desc()).all()

    payment_alerts = []
    for pc in payment_convs:
        client_name = pc.wa_contact_name or ""
        if pc.client_id:
            cl = db.query(Client).filter(Client.id == pc.client_id).first()
            if cl:
                client_name = cl.name
        payment_alerts.append(PaymentAlertItem(
            conversation_id=pc.id,
            client_name=client_name or pc.wa_contact_phone,
            phone=pc.wa_contact_phone,
            created_at=pc.last_message_at,
        ))

    # ---------- Top services today ----------
    service_counter = Counter()
    for a in today_appointments:
        svc_name = service_cache.get(a.service_id, "Otro")
        service_counter[svc_name] += 1

    top_services_today = [
        TopServiceItem(name=name, count=count)
        for name, count in service_counter.most_common(10)
    ]

    return DashboardStatsResponse(
        total_clients=total_clients,
        active_clients=active_clients,
        vip_clients=vip_clients,
        at_risk_clients=at_risk_clients,
        new_clients_this_month=new_clients_this_month,
        appointments_today=len(today_appointments),
        appointments_today_list=appointments_today_list,
        completed_today=completed_today,
        revenue_today=revenue_today,
        revenue_this_week=revenue_this_week,
        revenue_this_month=revenue_this_month,
        whatsapp_messages_today=whatsapp_messages_today,
        whatsapp_active_conversations=whatsapp_active_conversations,
        whatsapp_total_conversations=whatsapp_total_conversations,
        whatsapp_unread=whatsapp_unread,
        lina_is_global_active=lina_is_global_active,
        lina_messages_today=lina_messages_today,
        lina_actions_today=lina_actions_today,
        pending_tasks=pending_tasks,
        payment_alerts=payment_alerts,
        top_services_today=top_services_today,
        revenue_by_day=_revenue_by_day_paid(db, tid, today),
        **_client_intelligence_stats(db, tid),
    )


def _revenue_by_day_paid(db, tid, today):
    """Revenue per day for last 7 days — from VisitHistory (same source as Finances page)."""
    start = today - timedelta(days=6)
    q = db.query(VisitHistory.visit_date, func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
        VisitHistory.status == "completed",
        VisitHistory.visit_date >= start,
        VisitHistory.visit_date <= today,
    )
    if tid:
        q = q.filter(VisitHistory.tenant_id == tid)
    rows = q.group_by(VisitHistory.visit_date).all()
    day_map = {str(r[0]): int(r[1]) for r in rows}
    result = []
    for i in range(7):
        d = start + timedelta(days=i)
        key = str(d)
        result.append({"date": key, "revenue": day_map.get(key, 0)})
    return result


def _client_intelligence_stats(db, tid):
    """Calculate client intelligence metrics for dashboard."""
    try:
        from client_intelligence import forecast_revenue, calculate_visit_cycle
        forecast_7 = forecast_revenue(tid, days=7, db=db) if tid else {}
        forecast_30 = forecast_revenue(tid, days=30, db=db) if tid else {}

        # Count overdue/critical clients
        clients = db.query(Client).filter(Client.is_active == True)
        if tid:
            clients = clients.filter(Client.tenant_id == tid)
        overdue = 0
        critical = 0
        for c in clients.all():
            cycle = calculate_visit_cycle(c.id, db)
            if cycle["cycle_status"] == "overdue":
                overdue += 1
            elif cycle["cycle_status"] == "critical":
                critical += 1

        return {
            "revenue_forecast_7d": forecast_7.get("total_forecast", 0),
            "revenue_forecast_30d": forecast_30.get("total_forecast", 0),
            "clients_overdue": overdue,
            "clients_critical": critical,
        }
    except Exception as e:
        logger.warning(f"Client intelligence stats error: {e}")
        return {
            "revenue_forecast_7d": 0,
            "revenue_forecast_30d": 0,
            "clients_overdue": 0,
            "clients_critical": 0,
        }


# ============================================================================
# FINANCIAL SUMMARY
# ============================================================================

@router.get("/finances/summary", response_model=FinancialSummaryResponse)
def get_financial_summary(
    period: str = Query("month"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    tid = safe_tid(user, db)

    today = datetime.utcnow().date()

    # Determine date range
    if date_from and date_to:
        start = date.fromisoformat(date_from)
        end = date.fromisoformat(date_to)
    elif period == "today":
        start = end = today
    elif period == "week":
        start = today - timedelta(days=today.weekday())
        end = today
    elif period == "year":
        start = date(today.year, 1, 1)
        end = today
    else:  # month (default)
        start = date(today.year, today.month, 1)
        end = today

    # Previous period (same length, immediately before)
    period_days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=period_days - 1)

    # Base query: completed visits in range
    vq = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= start)
        .filter(VisitHistory.visit_date <= end)
    )
    if tid:
        vq = vq.filter(VisitHistory.tenant_id == tid)
    visits = vq.all()

    # Previous period visits
    pvq = (
        db.query(VisitHistory)
        .filter(VisitHistory.status == "completed")
        .filter(VisitHistory.visit_date >= prev_start)
        .filter(VisitHistory.visit_date <= prev_end)
    )
    if tid:
        pvq = pvq.filter(VisitHistory.tenant_id == tid)
    prev_visits_list = pvq.all()

    total_revenue = sum(v.amount for v in visits)
    total_visits = len(visits)
    avg_ticket = total_revenue // total_visits if total_visits > 0 else 0
    unique_clients = len(set(v.client_id for v in visits if v.client_id))

    prev_revenue = sum(v.amount for v in prev_visits_list)
    prev_visits_count = len(prev_visits_list)

    revenue_growth_pct = None
    if prev_revenue > 0:
        revenue_growth_pct = round(((total_revenue - prev_revenue) / prev_revenue) * 100, 1)
    elif total_revenue > 0:
        revenue_growth_pct = 100.0

    visits_growth_pct = None
    if prev_visits_count > 0:
        visits_growth_pct = round(((total_visits - prev_visits_count) / prev_visits_count) * 100, 1)
    elif total_visits > 0:
        visits_growth_pct = 100.0

    # Expenses (current + previous period)
    eq = db.query(Expense).filter(
        Expense.date >= start, Expense.date <= end, Expense.deleted_at.is_(None)
    )
    if tid:
        eq = eq.filter(Expense.tenant_id == tid)
    total_expenses = sum(e.amount or 0 for e in eq.all())

    peq = db.query(Expense).filter(
        Expense.date >= prev_start, Expense.date <= prev_end, Expense.deleted_at.is_(None)
    )
    if tid:
        peq = peq.filter(Expense.tenant_id == tid)
    prev_expenses = sum(e.amount or 0 for e in peq.all())

    expenses_growth_pct = None
    if prev_expenses > 0:
        expenses_growth_pct = round(((total_expenses - prev_expenses) / prev_expenses) * 100, 1)
    elif total_expenses > 0:
        expenses_growth_pct = 100.0

    # Unique clients in previous period (for client growth)
    prev_unique_clients = len(set(v.client_id for v in prev_visits_list if v.client_id))
    clients_growth_pct = None
    if prev_unique_clients > 0:
        clients_growth_pct = round(((unique_clients - prev_unique_clients) / prev_unique_clients) * 100, 1)
    elif unique_clients > 0:
        clients_growth_pct = 100.0

    net_profit = total_revenue - total_expenses
    prev_net_profit = prev_revenue - prev_expenses

    # Revenue by day
    day_map = {}
    for v in visits:
        d = v.visit_date.isoformat()
        if d not in day_map:
            day_map[d] = {"revenue": 0, "visits": 0}
        day_map[d]["revenue"] += v.amount
        day_map[d]["visits"] += 1

    revenue_by_day = [
        RevenueDayItem(date=d, revenue=info["revenue"], visits=info["visits"])
        for d, info in sorted(day_map.items())
    ]

    # Best day / busiest day
    best_day_date = None
    best_day_revenue = 0
    busiest_day_date = None
    busiest_day_visits = 0
    for d, info in day_map.items():
        if info["revenue"] > best_day_revenue:
            best_day_revenue = info["revenue"]
            best_day_date = d
        if info["visits"] > busiest_day_visits:
            busiest_day_visits = info["visits"]
            busiest_day_date = d

    # Service catalog cache for category lookup
    svc_catalog = {}
    svc_q = db.query(Service)
    if tid:
        svc_q = svc_q.filter(Service.tenant_id == tid)
    all_services = svc_q.all()
    for s in all_services:
        svc_catalog[s.name.lower().strip()] = s.category or "Otros"

    # Revenue by service (with category)
    svc_map = {}
    for v in visits:
        name = v.service_name
        if name not in svc_map:
            cat = svc_catalog.get(name.lower().strip(), "Otros")
            svc_map[name] = {"revenue": 0, "count": 0, "category": cat}
        svc_map[name]["revenue"] += v.amount
        svc_map[name]["count"] += 1

    revenue_by_service = sorted(
        [
            RevenueServiceItem(
                service_name=n,
                category=info["category"],
                revenue=info["revenue"],
                count=info["count"],
                pct_of_total=round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
            )
            for n, info in svc_map.items()
        ],
        key=lambda x: x.revenue,
        reverse=True,
    )

    # Revenue by category
    cat_map = {}
    for n, info in svc_map.items():
        cat = info["category"]
        if cat not in cat_map:
            cat_map[cat] = {"revenue": 0, "count": 0}
        cat_map[cat]["revenue"] += info["revenue"]
        cat_map[cat]["count"] += info["count"]

    revenue_by_category = sorted(
        [
            RevenueCategoryItem(
                category=c,
                revenue=info["revenue"],
                count=info["count"],
                pct_of_total=round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
            )
            for c, info in cat_map.items()
        ],
        key=lambda x: x.revenue,
        reverse=True,
    )

    # Revenue by staff
    staff_map_rev = {}
    staff_name_cache = {}
    for v in visits:
        if v.staff_id not in staff_name_cache:
            s = db.query(Staff).filter(Staff.id == v.staff_id).first()
            staff_name_cache[v.staff_id] = s.name if s else "Desconocido"
        sname = staff_name_cache[v.staff_id]
        if sname not in staff_map_rev:
            staff_map_rev[sname] = {"revenue": 0, "count": 0}
        staff_map_rev[sname]["revenue"] += v.amount
        staff_map_rev[sname]["count"] += 1

    revenue_by_staff = sorted(
        [
            RevenueStaffItem(
                staff_name=n,
                revenue=info["revenue"],
                count=info["count"],
                avg_ticket=info["revenue"] // info["count"] if info["count"] > 0 else 0,
                pct_of_total=round((info["revenue"] / total_revenue * 100), 1) if total_revenue > 0 else 0,
            )
            for n, info in staff_map_rev.items()
        ],
        key=lambda x: x.revenue,
        reverse=True,
    )

    # Pending payments — conversations tagged with pago pendiente
    pp_q = (
        db.query(func.count(WhatsAppConversation.id))
        .filter(cast(WhatsAppConversation.tags, String).ilike('%Pago pendiente%'))
    )
    if tid:
        pp_q = pp_q.filter(WhatsAppConversation.tenant_id == tid)
    pending_payments = pp_q.scalar() or 0

    return FinancialSummaryResponse(
        period=period,
        date_from=start.isoformat(),
        date_to=end.isoformat(),
        total_revenue=total_revenue,
        total_visits=total_visits,
        avg_ticket=avg_ticket,
        unique_clients=unique_clients,
        revenue_by_day=revenue_by_day,
        revenue_by_service=revenue_by_service,
        revenue_by_staff=revenue_by_staff,
        revenue_by_category=revenue_by_category,
        pending_payments=pending_payments,
        prev_revenue=prev_revenue,
        prev_visits=prev_visits_count,
        revenue_growth_pct=revenue_growth_pct,
        visits_growth_pct=visits_growth_pct,
        best_day_date=best_day_date,
        best_day_revenue=best_day_revenue,
        busiest_day_date=busiest_day_date,
        busiest_day_visits=busiest_day_visits,
        total_expenses=total_expenses,
        prev_expenses=prev_expenses,
        expenses_growth_pct=expenses_growth_pct,
        prev_unique_clients=prev_unique_clients,
        clients_growth_pct=clients_growth_pct,
        net_profit=net_profit,
        prev_net_profit=prev_net_profit,
    )


# ============================================================================
# PENDING NOTES / TASKS
# ============================================================================

@router.get("/notes/pending", response_model=List[PendingTaskItem])
def get_pending_notes(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    tid = safe_tid(user, db)

    from sqlalchemy import or_
    query = (
        db.query(ClientNote)
        .filter(or_(ClientNote.content.ilike("%PENDIENTE:%"), ClientNote.content.ilike("%RECORDATORIO:%")))
        .filter(~ClientNote.content.ilike("%RESUELTO:%"))
        .filter(~ClientNote.content.ilike("%COMPLETADO:%"))
        .filter(~ClientNote.content.ilike("%EXPIRADO:%"))
        .filter(~ClientNote.content.ilike("%FALLIDO:%"))
    )
    if tid:
        query = query.filter(ClientNote.tenant_id == tid)
    notes = query.order_by(ClientNote.created_at.desc()).limit(30).all()

    client_cache = {}
    result = []
    for n in notes:
        if n.client_id not in client_cache:
            cl = db.query(Client).filter(Client.id == n.client_id).first()
            client_cache[n.client_id] = cl.name if cl else "Desconocido"
        result.append(PendingTaskItem(
            id=n.id,
            client_id=n.client_id,
            client_name=client_cache[n.client_id],
            content=n.content,
            created_at=n.created_at,
        ))

    return result


@router.put("/notes/{note_id}/resolve")
def resolve_note(note_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Mark a PENDIENTE note as RESUELTO (admin manual resolution)."""
    tid = safe_tid(user, db)

    query = db.query(ClientNote).filter(ClientNote.id == note_id)
    if tid:
        query = query.filter(ClientNote.tenant_id == tid)
    note = query.first()
    if not note:
        raise HTTPException(status_code=404, detail="Nota no encontrada")
    from datetime import datetime
    # Handle both PENDIENTE: and RECORDATORIO: prefixes
    for prefix in ["PENDIENTE:", "RECORDATORIO:"]:
        note.content = note.content.replace(prefix, "COMPLETADO:")
    # Only append timestamp if not already resolved (prevent repeated appending)
    if "[Resuelto" not in note.content and "[Completado" not in note.content:
        note.content += f" [Completado por admin {datetime.utcnow().strftime('%d/%m %H:%M')}]"
    db.commit()
    return {"ok": True}


@router.delete("/payment-alert/{conversation_id}")
def dismiss_payment_alert(conversation_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Remove the Pago pendiente tag from a conversation."""
    tid = safe_tid(user, db)

    query = db.query(WhatsAppConversation).filter(WhatsAppConversation.id == conversation_id)
    if tid:
        query = query.filter(WhatsAppConversation.tenant_id == tid)
    conv = query.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversacion no encontrada")
    if conv.tags:
        conv.tags = [t for t in conv.tags if "Pago pendiente" not in t]
    db.commit()
    return {"ok": True}


# ============================================================================
# NO-SHOW RISK — Prediction per appointment
# ============================================================================

@router.get("/schedule/no-show-risk")
def appointment_no_show_risk(
    target: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Get no-show risk scores for all confirmed appointments on a date. ?target=2026-03-27"""
    from no_show_predictor import get_appointments_with_risk
    from routes._helpers import now_colombia

    tid = safe_tid(user, db)
    target_date = date.fromisoformat(target) if target else now_colombia().date()
    results = get_appointments_with_risk(db, target_date, tid)
    return {
        "date": target_date.isoformat(),
        "appointments": results,
        "high_risk_count": sum(1 for r in results if r["risk_score"] >= 45),
    }


# ============================================================================
# PRECISION SCHEDULING — Optimal slots per staff
# ============================================================================

@router.get("/schedule/optimal-slots")
def optimal_slots(
    target: str = Query(""),
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    """Get optimal (gap-filling) time slots per staff for a given date. Pass ?target=2026-03-27"""
    from database.models import Appointment, Staff, StaffSchedule
    from routes._helpers import now_colombia

    tid = safe_tid(user, db)
    try:
        target_date = date.fromisoformat(target) if target and target.strip() else now_colombia().date()
    except (ValueError, TypeError):
        target_date = now_colombia().date()
    weekday = target_date.weekday()

    # Get active staff
    staff_q = db.query(Staff).filter(Staff.is_active == True)
    if tid:
        staff_q = staff_q.filter(Staff.tenant_id == tid)
    all_staff = staff_q.all()
    print(f"[OPTIMAL-SLOTS] date={target_date}, tid={tid}, staff_count={len(all_staff)}")

    # Get appointments for the date
    apts_q = db.query(Appointment).filter(
        Appointment.date == target_date,
        Appointment.status.in_(["confirmed", "completed", "paid"]),
    )
    if tid:
        apts_q = apts_q.filter(Appointment.tenant_id == tid)
    all_apts = apts_q.order_by(Appointment.time).all()

    OPEN_H, CLOSE_H = 8, 20

    results = []
    for s in all_staff:
        # Check staff schedule for this day
        try:
            sched = db.query(StaffSchedule).filter(
                StaffSchedule.staff_id == s.id,
                StaffSchedule.day_of_week == weekday,
                StaffSchedule.is_working == True,
            ).first()
            if sched:
                s_open = int(sched.start_time.split(":")[0]) if sched.start_time else OPEN_H
                s_close = int(sched.end_time.split(":")[0]) if sched.end_time else CLOSE_H
            else:
                s_open, s_close = OPEN_H, CLOSE_H
        except Exception:
            s_open, s_close = OPEN_H, CLOSE_H

        # Build busy intervals for this staff
        s_apts = sorted([a for a in all_apts if a.staff_id == s.id], key=lambda a: a.time)
        busy = []
        for a in s_apts:
            try:
                h, m = int(a.time.split(":")[0]), int(a.time.split(":")[1])
                start = h * 60 + m
                end = start + (a.duration_minutes or 30)
                busy.append((start, end))
            except (ValueError, AttributeError):
                pass

        # Find free slots
        free_slots = []
        t = s_open * 60
        close = s_close * 60
        for bs, be in busy:
            if t < bs and (bs - t) >= 15:
                free_slots.append({
                    "start": f"{t // 60:02d}:{t % 60:02d}",
                    "end": f"{bs // 60:02d}:{bs % 60:02d}",
                    "duration_min": bs - t,
                    "type": "gap",
                    "priority": "high",
                    "reason": "Llena hueco entre citas",
                })
            t = max(t, be)
        if t < close and (close - t) >= 15:
            free_slots.append({
                "start": f"{t // 60:02d}:{t % 60:02d}",
                "end": f"{close // 60:02d}:{close % 60:02d}",
                "duration_min": close - t,
                "type": "tail",
                "priority": "normal",
                "reason": "Final del dia",
            })

        # Sort: gaps first, then by start time
        free_slots.sort(key=lambda x: (0 if x["type"] == "gap" else 1, x["start"]))

        results.append({
            "staff_id": s.id,
            "staff_name": s.name,
            "total_appointments": len(s_apts),
            "working_hours": f"{s_open:02d}:00 - {s_close:02d}:00",
            "free_slots": free_slots,
            "utilization_pct": round(sum(b[1] - b[0] for b in busy) / max(1, (s_close - s_open) * 60) * 100, 1),
        })

    return {
        "date": target_date.isoformat(),
        "staff": results,
    }
