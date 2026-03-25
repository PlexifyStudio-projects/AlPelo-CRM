"""
Plexify Studio — Dev Panel MEGA Endpoints
Cross-tenant comparison, MRR trends, health monitoring, alerts, error logs,
and AI Business Prospector.
"""

import os
import json
import time
import sys
import platform
import httpx
import traceback as tb_module

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from datetime import datetime, timedelta, date

from database.connection import get_db, SessionLocal
from database.models import (
    Admin, Tenant, UsageMetrics, PlatformConfig,
    Client, Staff, WhatsAppMessage, WhatsAppConversation,
    Appointment, Service, VisitHistory, BusinessProspect, ErrorLog,
    AIProvider,
)
from middleware.auth_middleware import get_current_user

router = APIRouter()

DEV_ROLES = ["dev", "super_admin"]


def _require_dev(current_user: Admin):
    if current_user.role not in DEV_ROLES:
        raise HTTPException(status_code=403, detail="Developer access required")
    return current_user


# ============================================================================
# 1. CROSS-TENANT COMPARISON
# ============================================================================

@router.get("/dev/comparison")
def dev_comparison(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Previous month for growth calc
    if now.month == 1:
        prev_period = f"{now.year - 1}-12"
        prev_month_start = month_start.replace(year=now.year - 1, month=12)
    else:
        prev_period = f"{now.year}-{now.month - 1:02d}"
        prev_month_start = month_start.replace(month=now.month - 1)

    result = []
    for t in tenants:
        tid = t.id

        clients = db.query(func.count(Client.id)).filter(Client.tenant_id == tid).scalar() or 0
        staff = db.query(func.count(Staff.id)).filter(Staff.tenant_id == tid).scalar() or 0

        # Messages
        messages_used = getattr(t, 'messages_used', 0)
        messages_limit = getattr(t, 'messages_limit', 5000)

        # AI tokens this month
        usage = db.query(UsageMetrics).filter(
            UsageMetrics.tenant_id == tid,
            UsageMetrics.period == current_period,
        ).first()
        ai_tokens = usage.ai_tokens_used if usage else 0

        # Revenue this month
        revenue = db.query(func.coalesce(func.sum(VisitHistory.amount), 0)).filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.visit_date >= month_start.date(),
        ).scalar() or 0

        # Appointments this month
        appointments = db.query(func.count(Appointment.id)).filter(
            Appointment.tenant_id == tid,
            Appointment.date >= month_start.date(),
        ).scalar() or 0

        # Client growth (new this month vs last month)
        new_this = db.query(func.count(Client.id)).filter(
            Client.tenant_id == tid,
            Client.created_at >= month_start,
        ).scalar() or 0
        new_prev = db.query(func.count(Client.id)).filter(
            Client.tenant_id == tid,
            Client.created_at >= prev_month_start,
            Client.created_at < month_start,
        ).scalar() or 0
        growth_rate = round(((new_this - new_prev) / max(new_prev, 1)) * 100, 1)

        result.append({
            "id": tid,
            "name": t.name,
            "slug": t.slug,
            "clients": clients,
            "staff": staff,
            "messages_used": messages_used,
            "messages_limit": messages_limit,
            "ai_tokens_month": ai_tokens,
            "revenue_month": revenue,
            "appointments_month": appointments,
            "new_clients_month": new_this,
            "growth_rate": growth_rate,
            "monthly_price": getattr(t, 'monthly_price', 0),
        })

    return {
        "tenants": result,
        "period": current_period,
    }


# ============================================================================
# 2. MRR HISTORY & TRENDS
# ============================================================================

@router.get("/dev/mrr-history")
def dev_mrr_history(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    months = []

    for i in range(11, -1, -1):
        # Calculate month
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        period = f"{y}-{m:02d}"
        month_start = datetime(y, m, 1)
        if m == 12:
            month_end = datetime(y + 1, 1, 1)
        else:
            month_end = datetime(y, m + 1, 1)

        # Active tenants in that month (created before month_end and still active or paid_until >= month_start)
        active = db.query(Tenant).filter(
            Tenant.created_at < month_end,
            Tenant.is_active == True,
        ).all()

        mrr = sum(getattr(t, 'monthly_price', 0) for t in active)
        active_count = len(active)

        # New tenants this month
        new_tenants = db.query(func.count(Tenant.id)).filter(
            Tenant.created_at >= month_start,
            Tenant.created_at < month_end,
        ).scalar() or 0

        # Usage metrics for the period
        usage = db.query(
            func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0),
            func.coalesce(func.sum(UsageMetrics.wa_messages_sent), 0),
        ).filter(UsageMetrics.period == period).first()

        months.append({
            "period": period,
            "mrr": mrr,
            "active_tenants": active_count,
            "new_tenants": new_tenants,
            "ai_tokens": usage[0] if usage else 0,
            "messages_sent": usage[1] if usage else 0,
        })

    # Current MRR
    current_mrr = months[-1]["mrr"] if months else 0
    prev_mrr = months[-2]["mrr"] if len(months) >= 2 else 0
    growth_rate = round(((current_mrr - prev_mrr) / max(prev_mrr, 1)) * 100, 1) if prev_mrr else 0

    # Simple linear projection (last 6 months)
    recent = [m["mrr"] for m in months[-6:]]
    if len(recent) >= 2:
        avg_delta = (recent[-1] - recent[0]) / max(len(recent) - 1, 1)
        projection = [max(0, round(recent[-1] + avg_delta * (j + 1))) for j in range(3)]
    else:
        projection = [current_mrr] * 3

    return {
        "months": months,
        "current_mrr": current_mrr,
        "growth_rate": growth_rate,
        "projection_next_3": projection,
    }


# ============================================================================
# 3. HEALTH MONITORING
# ============================================================================

@router.get("/dev/health")
def dev_health(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    # DB latency
    start = time.time()
    db.execute(text("SELECT 1"))
    db_latency = round((time.time() - start) * 1000, 1)

    # DB pool stats
    try:
        engine = db.get_bind()
        pool = engine.pool
        pool_info = {
            "size": pool.size(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "checked_in": pool.checkedin(),
        }
    except Exception:
        pool_info = {"size": "unknown", "checked_out": "unknown"}

    # WhatsApp status per tenant
    tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
    wa_connected = 0
    wa_disconnected = 0
    wa_expiring = 0
    wa_details = []
    for t in tenants:
        token = getattr(t, 'wa_access_token', None)
        expires = getattr(t, 'wa_token_expires_at', None)
        if token:
            wa_connected += 1
            if expires and expires < datetime.utcnow() + timedelta(days=3):
                wa_expiring += 1
                wa_details.append({"tenant": t.name, "status": "expiring", "expires": expires.isoformat()})
            else:
                wa_details.append({"tenant": t.name, "status": "connected"})
        else:
            wa_disconnected += 1
            wa_details.append({"tenant": t.name, "status": "disconnected"})

    # AI status
    ai_key = os.getenv("ANTHROPIC_API_KEY")
    ai_status = "operational" if ai_key else "no_key"

    # Error rate (last hour and last 24h)
    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)
    errors_hour = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= hour_ago).scalar() or 0
    errors_day = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= day_ago).scalar() or 0

    # System info — no external deps
    try:
        import resource
        usage = resource.getrusage(resource.RUSAGE_SELF)
        memory_info = {"rss_mb": round(usage.ru_maxrss / 1024), "used_pct": "N/A"}
    except Exception:
        memory_info = {"rss_mb": "unknown", "used_pct": "N/A"}

    return {
        "db": {
            "status": "healthy" if db_latency < 500 else "slow",
            "latency_ms": db_latency,
            "pool": pool_info,
        },
        "whatsapp": {
            "connected": wa_connected,
            "disconnected": wa_disconnected,
            "expiring_soon": wa_expiring,
            "tenants": wa_details,
        },
        "ai": {
            "status": ai_status,
            "model": "claude-sonnet-4-20250514",
        },
        "errors": {
            "last_hour": errors_hour,
            "last_24h": errors_day,
        },
        "system": {
            "python": sys.version.split()[0],
            "platform": platform.system(),
            "memory": memory_info,
        },
        "timestamp": now.isoformat(),
    }


# ============================================================================
# 4. AUTOMATIC ALERTS
# ============================================================================

@router.get("/dev/alerts")
def dev_alerts(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    alerts = []
    tenants = db.query(Tenant).all()
    now = datetime.utcnow()

    for t in tenants:
        tid = t.id
        name = t.name

        # Message limit >80%
        used = getattr(t, 'messages_used', 0)
        limit = getattr(t, 'messages_limit', 5000)
        if limit > 0 and used > limit * 0.8:
            pct = round((used / limit) * 100, 1)
            severity = "critical" if pct >= 95 else "warning"
            alerts.append({
                "type": "message_limit",
                "severity": severity,
                "tenant": name,
                "tenant_id": tid,
                "message": f"{name} ha usado {pct}% de su limite de mensajes ({used}/{limit})",
                "value": pct,
                "timestamp": now.isoformat(),
            })

        # Overdue payment
        paid_until = getattr(t, 'paid_until', None)
        if paid_until and paid_until < date.today():
            days_overdue = (date.today() - paid_until).days
            alerts.append({
                "type": "overdue_payment",
                "severity": "critical",
                "tenant": name,
                "tenant_id": tid,
                "message": f"{name} tiene el pago vencido hace {days_overdue} dias",
                "value": days_overdue,
                "timestamp": now.isoformat(),
            })

        # WA disconnected
        wa_token = getattr(t, 'wa_access_token', None)
        wa_expires = getattr(t, 'wa_token_expires_at', None)
        if getattr(t, 'is_active', True):
            if not wa_token:
                alerts.append({
                    "type": "wa_disconnected",
                    "severity": "warning",
                    "tenant": name,
                    "tenant_id": tid,
                    "message": f"{name} no tiene WhatsApp conectado",
                    "timestamp": now.isoformat(),
                })
            elif wa_expires and wa_expires < now + timedelta(days=3):
                alerts.append({
                    "type": "wa_expiring",
                    "severity": "warning",
                    "tenant": name,
                    "tenant_id": tid,
                    "message": f"Token de WhatsApp de {name} expira pronto",
                    "timestamp": now.isoformat(),
                })

        # AI paused
        if getattr(t, 'ai_is_paused', False) and getattr(t, 'is_active', True):
            alerts.append({
                "type": "ai_paused",
                "severity": "info",
                "tenant": name,
                "tenant_id": tid,
                "message": f"La IA de {name} esta pausada",
                "timestamp": now.isoformat(),
            })

    # AI token spike: compare current month to previous
    current_period = f"{now.year}-{now.month:02d}"
    if now.month == 1:
        prev_period = f"{now.year - 1}-12"
    else:
        prev_period = f"{now.year}-{now.month - 1:02d}"

    curr_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
        UsageMetrics.period == current_period
    ).scalar() or 0
    prev_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
        UsageMetrics.period == prev_period
    ).scalar() or 0

    if prev_tokens > 0 and curr_tokens > prev_tokens * 2:
        alerts.append({
            "type": "token_spike",
            "severity": "warning",
            "tenant": "Plataforma",
            "message": f"Spike de tokens: {curr_tokens:,} este mes vs {prev_tokens:,} el mes pasado",
            "timestamp": now.isoformat(),
        })

    # Recent errors
    errors_hour = db.query(func.count(ErrorLog.id)).filter(
        ErrorLog.created_at >= now - timedelta(hours=1)
    ).scalar() or 0
    if errors_hour >= 5:
        alerts.append({
            "type": "error_spike",
            "severity": "critical",
            "tenant": "Plataforma",
            "message": f"{errors_hour} errores en la ultima hora",
            "timestamp": now.isoformat(),
        })

    # Sort: critical first, then warning, then info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return {
        "alerts": alerts,
        "total": len(alerts),
        "critical": sum(1 for a in alerts if a["severity"] == "critical"),
        "warning": sum(1 for a in alerts if a["severity"] == "warning"),
    }


# ============================================================================
# 5. ERROR LOGS
# ============================================================================

@router.get("/dev/errors")
def dev_errors(
    days: int = 7,
    error_type: str = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    cutoff = datetime.utcnow() - timedelta(days=days)
    query = db.query(ErrorLog).filter(ErrorLog.created_at >= cutoff)

    if error_type:
        query = query.filter(ErrorLog.error_type == error_type)

    errors = query.order_by(ErrorLog.created_at.desc()).limit(200).all()

    # Stats
    total = db.query(func.count(ErrorLog.id)).filter(ErrorLog.created_at >= cutoff).scalar() or 0
    by_type = db.query(
        ErrorLog.error_type, func.count(ErrorLog.id)
    ).filter(ErrorLog.created_at >= cutoff).group_by(ErrorLog.error_type).all()

    return {
        "errors": [
            {
                "id": e.id,
                "endpoint": e.endpoint,
                "method": e.method,
                "status_code": e.status_code,
                "error_type": e.error_type,
                "message": e.message,
                "traceback": e.traceback_text,
                "tenant_id": e.tenant_id,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in errors
        ],
        "total": total,
        "by_type": {t: c for t, c in by_type if t},
        "period_days": days,
    }


# ============================================================================
# 6. AI BUSINESS PROSPECTOR
# ============================================================================

_MODEL = "claude-sonnet-4-20250514"
_API_URL = "https://api.anthropic.com/v1/messages"

PROSPECT_CATEGORIES = [
    "Peluquerias", "Barberias", "Restaurantes", "Odontologia",
    "Clinicas/Hospitales", "Spas", "Gimnasios", "Veterinarias",
    "Hoteles", "Salones de belleza", "Nail salons", "Lavaderos de autos",
    "Lavanderias", "Pet groomers", "Tattoo studios", "Fisioterapia",
    "Opticas", "Psicologia", "Guarderias", "Yoga studios",
    "Coworking spaces", "Centros esteticos", "Consultorios medicos",
    "Academias de baile", "Escuelas de musica",
]


def _call_prospector_ai(system_prompt: str, user_message: str, max_tokens: int = 4096) -> dict:
    """Call Claude for business prospecting. Platform-level, no tenant billing."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="API key de IA no configurada")

    payload = {
        "model": _MODEL,
        "max_tokens": max_tokens,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user_message}],
        "temperature": 0.5,
    }
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        print(f"[Prospector] Claude HTTP error: {e.response.status_code}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")
    except Exception as e:
        print(f"[Prospector] Claude error: {e}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")

    result = response.json()

    # Track usage at platform level (tenant_id=0)
    tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
    try:
        from routes._usage_tracker import track_ai_usage
        track_ai_usage(tokens, tenant_id=0)
    except Exception:
        pass

    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")

    text = text.strip()
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw_response": text, "prospects": []}


@router.post("/dev/prospect/generate")
def generate_prospects(
    data: dict,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    city = (data.get("city") or "Bucaramanga").strip()
    categories = data.get("categories", ["Peluquerias", "Barberias"])
    count = min(int(data.get("count", 10)), 20)

    # Exclude already-saved prospects in this city
    existing = db.query(BusinessProspect.name).filter(
        func.lower(BusinessProspect.city) == city.lower()
    ).all()
    exclude_names = [e[0] for e in existing]

    system_prompt = """Eres un analista de mercado senior especializado en negocios de servicios en Colombia y Latinoamerica.

Tu tarea es identificar negocios REALES y PLAUSIBLES que podrian beneficiarse de un CRM SaaS llamado Plexify Studio.
Plexify Studio ofrece: gestion de clientes, agendamiento, WhatsApp Business automatizado, IA asistente, campanas masivas, finanzas, y fidelizacion.

REGLAS ESTRICTAS:
1. Los negocios deben ser PLAUSIBLES para la ciudad indicada (nombres reales, direcciones logicas)
2. Analiza el mercado local: que tipo de negocio tiene mas demanda, competencia, y potencial
3. Para cada prospecto, analiza POR QUE necesitarian Plexify (pain points especificos de su tipo de negocio)
4. Si no tienes informacion exacta de un campo, pon null — NO inventes datos de contacto falsos
5. Responde UNICAMENTE con un JSON valido, sin texto adicional fuera del JSON

FORMATO DE RESPUESTA (JSON array):
[
  {
    "name": "Nombre del negocio",
    "owner_name": "Nombre del dueno si es conocido o null",
    "phone": "Telefono si es conocido o null",
    "email": "Email si es conocido o null",
    "business_type": "Categoria exacta del negocio",
    "address": "Direccion o zona aproximada en la ciudad",
    "ai_analysis": "Analisis del mercado de este tipo de negocio en la ciudad: tamano del mercado, competencia, tendencias, oportunidades",
    "why_plexify": "Razon especifica por la que este negocio se beneficiaria de Plexify Studio: pain points, problemas que resuelve, ROI estimado"
  }
]"""

    exclude_text = ""
    if exclude_names:
        exclude_text = f"\n\nEXCLUIR estos negocios ya registrados (NO los incluyas): {', '.join(exclude_names[:50])}"

    user_msg = f"""Genera {count} prospectos de negocios en {city}, Colombia.

Categorias de interes: {', '.join(categories)}
{exclude_text}

Prioriza negocios que:
- Manejen alto volumen de clientes recurrentes
- Necesiten agendamiento y confirmaciones
- Se beneficien de WhatsApp automatizado
- Tengan potencial de crecimiento con tecnologia

Responde SOLO con el JSON array."""

    result = _call_prospector_ai(system_prompt, user_msg, max_tokens=4096)

    # Parse and save prospects
    prospects_data = result if isinstance(result, list) else result.get("prospects", result.get("raw_response", []))
    if not isinstance(prospects_data, list):
        raise HTTPException(status_code=502, detail="La IA no devolvio un formato valido de prospectos")

    saved = []
    for p in prospects_data:
        if not isinstance(p, dict) or not p.get("name"):
            continue

        # Skip duplicates
        exists = db.query(BusinessProspect).filter(
            func.lower(BusinessProspect.name) == p["name"].lower(),
            func.lower(BusinessProspect.city) == city.lower(),
        ).first()
        if exists:
            continue

        prospect = BusinessProspect(
            name=p["name"],
            owner_name=p.get("owner_name"),
            phone=p.get("phone"),
            email=p.get("email"),
            business_type=p.get("business_type"),
            city=city,
            address=p.get("address"),
            ai_analysis=p.get("ai_analysis"),
            why_plexify=p.get("why_plexify"),
            status="pending",
            source="ai_prospector",
        )
        db.add(prospect)
        saved.append(p["name"])

    db.commit()

    return {
        "generated": len(prospects_data),
        "saved": len(saved),
        "duplicates_skipped": len(prospects_data) - len(saved),
        "names": saved,
    }


@router.get("/dev/prospects")
def list_prospects(
    status: str = None,
    city: str = None,
    business_type: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    query = db.query(BusinessProspect)

    if status:
        query = query.filter(BusinessProspect.status == status)
    if city:
        query = query.filter(func.lower(BusinessProspect.city) == city.lower())
    if business_type:
        query = query.filter(func.lower(BusinessProspect.business_type).contains(business_type.lower()))
    if search:
        search_pattern = f"%{search.lower()}%"
        query = query.filter(
            func.lower(BusinessProspect.name).like(search_pattern)
            | func.lower(BusinessProspect.owner_name).like(search_pattern)
            | func.lower(BusinessProspect.business_type).like(search_pattern)
        )

    prospects = query.order_by(BusinessProspect.created_at.desc()).limit(500).all()

    # Stats
    total = db.query(func.count(BusinessProspect.id)).scalar() or 0
    by_status = db.query(
        BusinessProspect.status, func.count(BusinessProspect.id)
    ).group_by(BusinessProspect.status).all()

    return {
        "prospects": [
            {
                "id": p.id,
                "name": p.name,
                "owner_name": p.owner_name,
                "phone": p.phone,
                "email": p.email,
                "business_type": p.business_type,
                "city": p.city,
                "address": p.address,
                "ai_analysis": p.ai_analysis,
                "why_plexify": p.why_plexify,
                "status": p.status,
                "notes": p.notes,
                "source": p.source,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
                "contacted_at": p.contacted_at.isoformat() if p.contacted_at else None,
            }
            for p in prospects
        ],
        "total": total,
        "by_status": {s: c for s, c in by_status},
    }


@router.put("/dev/prospects/{prospect_id}")
def update_prospect(
    prospect_id: int,
    data: dict,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    prospect = db.query(BusinessProspect).filter(BusinessProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto no encontrado")

    if "status" in data:
        prospect.status = data["status"]
        if data["status"] == "contacted" and not prospect.contacted_at:
            prospect.contacted_at = datetime.utcnow()

    if "notes" in data:
        prospect.notes = data["notes"]

    if "phone" in data:
        prospect.phone = data["phone"]
    if "email" in data:
        prospect.email = data["email"]
    if "owner_name" in data:
        prospect.owner_name = data["owner_name"]

    prospect.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "id": prospect.id, "status": prospect.status}


@router.delete("/dev/prospects/{prospect_id}")
def delete_prospect(
    prospect_id: int,
    db: Session = Depends(get_db),
    user: Admin = Depends(get_current_user),
):
    _require_dev(user)

    prospect = db.query(BusinessProspect).filter(BusinessProspect.id == prospect_id).first()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospecto no encontrado")

    db.delete(prospect)
    db.commit()

    return {"ok": True, "deleted": prospect_id}


@router.get("/dev/prospect/categories")
def prospect_categories(user: Admin = Depends(get_current_user)):
    _require_dev(user)
    return {"categories": PROSPECT_CATEGORIES}


# ============================================================================
# 7. AI PROVIDER MANAGEMENT — Multi-provider with failover
# ============================================================================

AI_PROVIDER_TYPES = [
    {"id": "anthropic", "name": "Anthropic (Claude)", "models": [
        "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-opus-4-20250514",
    ]},
    {"id": "openai", "name": "OpenAI (ChatGPT)", "models": [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
    ]},
    {"id": "google", "name": "Google (Gemini)", "models": [
        "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash",
    ]},
    {"id": "deepseek", "name": "DeepSeek", "models": [
        "deepseek-chat", "deepseek-reasoner",
    ]},
    {"id": "mistral", "name": "Mistral AI", "models": [
        "mistral-large-latest", "mistral-medium-latest", "mistral-small-latest",
    ]},
    {"id": "groq", "name": "Groq (Fast inference)", "models": [
        "llama-3.3-70b-versatile", "mixtral-8x7b-32768",
    ]},
]


@router.get("/dev/ai-providers")
def list_ai_providers(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    providers = db.query(AIProvider).order_by(AIProvider.priority.asc()).all()
    return {
        "providers": [
            {
                "id": p.id,
                "name": p.name,
                "provider_type": p.provider_type,
                "api_key_preview": f"***{p.api_key[-4:]}" if p.api_key and len(p.api_key) > 4 else "***",
                "model": p.model,
                "priority": p.priority,
                "is_active": p.is_active,
                "is_primary": p.is_primary,
                "status": p.status,
                "last_health_check": p.last_health_check.isoformat() if p.last_health_check else None,
                "input_cost_per_mtok": p.input_cost_per_mtok,
                "output_cost_per_mtok": p.output_cost_per_mtok,
                "notes": p.notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in providers
        ],
        "available_types": AI_PROVIDER_TYPES,
    }


@router.post("/dev/ai-providers")
def create_ai_provider(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    name = (data.get("name") or "").strip()
    provider_type = (data.get("provider_type") or "").strip()
    api_key = (data.get("api_key") or "").strip()
    model = (data.get("model") or "").strip()

    if not name or not provider_type or not api_key or not model:
        raise HTTPException(status_code=400, detail="Nombre, tipo, API key y modelo son requeridos")

    # If this is the first provider or marked as primary, set it
    existing_count = db.query(func.count(AIProvider.id)).scalar() or 0
    is_primary = data.get("is_primary", existing_count == 0)

    if is_primary:
        # Unset any existing primary
        db.query(AIProvider).filter(AIProvider.is_primary == True).update({"is_primary": False})

    provider = AIProvider(
        name=name,
        provider_type=provider_type,
        api_key=api_key,
        model=model,
        priority=data.get("priority", existing_count + 1),
        is_active=True,
        is_primary=is_primary,
        status="unknown",
        input_cost_per_mtok=data.get("input_cost_per_mtok", 3.0),
        output_cost_per_mtok=data.get("output_cost_per_mtok", 15.0),
        notes=data.get("notes"),
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)

    return {"ok": True, "id": provider.id, "name": provider.name, "is_primary": provider.is_primary}


@router.put("/dev/ai-providers/{provider_id}")
def update_ai_provider(provider_id: int, data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    for field in ["name", "provider_type", "model", "notes"]:
        if field in data:
            setattr(p, field, data[field])
    if "api_key" in data and data["api_key"]:
        p.api_key = data["api_key"]
    if "is_active" in data:
        p.is_active = data["is_active"]
    if "priority" in data:
        p.priority = data["priority"]
    if "input_cost_per_mtok" in data:
        p.input_cost_per_mtok = data["input_cost_per_mtok"]
    if "output_cost_per_mtok" in data:
        p.output_cost_per_mtok = data["output_cost_per_mtok"]

    if data.get("is_primary"):
        db.query(AIProvider).filter(AIProvider.id != provider_id, AIProvider.is_primary == True).update({"is_primary": False})
        p.is_primary = True

    p.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True, "id": p.id}


@router.delete("/dev/ai-providers/{provider_id}")
def delete_ai_provider(provider_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if p.is_primary:
        raise HTTPException(status_code=400, detail="No puedes eliminar el proveedor primario. Asigna otro como primario primero.")

    db.delete(p)
    db.commit()
    return {"ok": True, "deleted": provider_id}


@router.post("/dev/ai-providers/{provider_id}/health-check")
def check_ai_provider_health(provider_id: int, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    """Quick health check — send a tiny prompt to verify the provider works."""
    _require_dev(user)

    p = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    try:
        if p.provider_type == "anthropic":
            resp = httpx.post(
                "https://api.anthropic.com/v1/messages",
                json={"model": p.model, "max_tokens": 10, "messages": [{"role": "user", "content": "ping"}]},
                headers={"x-api-key": p.api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        elif p.provider_type == "openai":
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                json={"model": p.model, "max_tokens": 10, "messages": [{"role": "user", "content": "ping"}]},
                headers={"Authorization": f"Bearer {p.api_key}", "Content-Type": "application/json"},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        elif p.provider_type == "google":
            resp = httpx.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{p.model}:generateContent?key={p.api_key}",
                json={"contents": [{"parts": [{"text": "ping"}]}]},
                timeout=15.0,
            )
            resp.raise_for_status()
            p.status = "healthy"

        else:
            p.status = "unknown"

    except httpx.HTTPStatusError as e:
        p.status = "down"
        p.notes = f"HTTP {e.response.status_code}: {e.response.text[:200]}"
    except Exception as e:
        p.status = "down"
        p.notes = f"Error: {str(e)[:200]}"

    p.last_health_check = datetime.utcnow()
    db.commit()

    return {"id": p.id, "status": p.status, "checked_at": p.last_health_check.isoformat()}


# ============================================================================
# 8. AI COST BREAKDOWN — Real-time desglose
# ============================================================================

@router.get("/dev/ai-cost-breakdown")
def ai_cost_breakdown(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)

    now = datetime.utcnow()
    current_period = f"{now.year}-{now.month:02d}"

    # Get primary provider costs
    primary = db.query(AIProvider).filter(AIProvider.is_primary == True).first()
    input_rate = primary.input_cost_per_mtok if primary else 3.0
    output_rate = primary.output_cost_per_mtok if primary else 15.0
    blended_rate = (input_rate + output_rate) / 2  # simplified blend

    # Per-tenant breakdown this month
    metrics = db.query(UsageMetrics).filter(UsageMetrics.period == current_period).all()
    tenants = {t.id: t.name for t in db.query(Tenant).all()}

    tenant_costs = []
    total_tokens_month = 0
    total_messages_month = 0

    for m in metrics:
        tokens = m.ai_tokens_used or 0
        msgs = (m.wa_messages_sent or 0) + (m.wa_messages_received or 0)
        campaigns = m.campaigns_sent or 0
        cost_usd = round((tokens / 1_000_000) * blended_rate, 4)
        total_tokens_month += tokens
        total_messages_month += msgs

        tenant_costs.append({
            "tenant_id": m.tenant_id,
            "tenant_name": tenants.get(m.tenant_id, f"Tenant {m.tenant_id}"),
            "tokens": tokens,
            "messages_sent": m.wa_messages_sent or 0,
            "messages_received": m.wa_messages_received or 0,
            "campaigns": campaigns,
            "cost_usd": cost_usd,
            "cost_cop": round(cost_usd * 4200),
        })

    # All-time totals
    all_time = db.query(
        func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0),
        func.coalesce(func.sum(UsageMetrics.wa_messages_sent), 0),
        func.coalesce(func.sum(UsageMetrics.campaigns_sent), 0),
    ).first()

    total_cost_month_usd = round((total_tokens_month / 1_000_000) * blended_rate, 4)
    total_cost_alltime_usd = round((all_time[0] / 1_000_000) * blended_rate, 4)

    # Historical by month (last 6 months)
    history = []
    for i in range(5, -1, -1):
        y = now.year
        mo = now.month - i
        while mo <= 0:
            mo += 12
            y -= 1
        period = f"{y}-{mo:02d}"
        period_tokens = db.query(func.coalesce(func.sum(UsageMetrics.ai_tokens_used), 0)).filter(
            UsageMetrics.period == period
        ).scalar() or 0
        period_cost = round((period_tokens / 1_000_000) * blended_rate, 4)
        history.append({"period": period, "tokens": period_tokens, "cost_usd": period_cost, "cost_cop": round(period_cost * 4200)})

    # Cost per action type (estimated)
    lina_msgs = db.query(func.count(WhatsAppMessage.id)).filter(
        WhatsAppMessage.sent_by == 'lina_ia',
        WhatsAppMessage.created_at >= now.replace(day=1, hour=0, minute=0, second=0, microsecond=0),
    ).scalar() or 0
    avg_tokens_per_lina = 800  # ~800 tokens avg per Lina response
    lina_cost_usd = round((lina_msgs * avg_tokens_per_lina / 1_000_000) * blended_rate, 4)

    return {
        "period": current_period,
        "provider": {
            "name": primary.name if primary else "Sin configurar",
            "model": primary.model if primary else "N/A",
            "input_rate": input_rate,
            "output_rate": output_rate,
            "blended_rate": round(blended_rate, 2),
        },
        "trm": 4200,
        "this_month": {
            "tokens": total_tokens_month,
            "cost_usd": total_cost_month_usd,
            "cost_cop": round(total_cost_month_usd * 4200),
            "messages": total_messages_month,
            "by_tenant": sorted(tenant_costs, key=lambda x: x["cost_usd"], reverse=True),
        },
        "all_time": {
            "tokens": all_time[0],
            "messages": all_time[1],
            "campaigns": all_time[2],
            "cost_usd": total_cost_alltime_usd,
            "cost_cop": round(total_cost_alltime_usd * 4200),
        },
        "estimated_by_action": {
            "lina_responses": {"count": lina_msgs, "est_tokens": lina_msgs * avg_tokens_per_lina, "cost_usd": lina_cost_usd, "cost_cop": round(lina_cost_usd * 4200)},
            "strategy_calls": {"note": "~4000 tokens per call, tracked in usage_metrics"},
            "prospector_calls": {"note": "~3000 tokens per call, tracked in usage_metrics"},
        },
        "history": history,
    }


# ============================================================================
# 9. ALLOWED ORIGINS — Editable from Dev Panel
# ============================================================================

@router.get("/dev/allowed-origins")
def get_allowed_origins(db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    origins_str = os.environ.get("ALLOWED_ORIGINS", "")
    origins = [o.strip() for o in origins_str.split(",") if o.strip()]
    return {"origins": origins, "raw": origins_str}


@router.put("/dev/allowed-origins")
def update_allowed_origins(data: dict, db: Session = Depends(get_db), user: Admin = Depends(get_current_user)):
    _require_dev(user)
    origins = data.get("origins", [])
    if not isinstance(origins, list):
        raise HTTPException(status_code=400, detail="Origins debe ser una lista")
    new_val = ",".join(o.strip() for o in origins if o.strip())
    os.environ["ALLOWED_ORIGINS"] = new_val

    # Also save to PlatformConfig for persistence
    existing = db.query(PlatformConfig).filter(PlatformConfig.key == "ALLOWED_ORIGINS").first()
    if existing:
        existing.value = new_val
    else:
        db.add(PlatformConfig(key="ALLOWED_ORIGINS", value=new_val, is_secret=False))
    db.commit()

    return {"ok": True, "origins": origins}
