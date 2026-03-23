# ============================================================================
# Plexify Studio — AI Strategic Intelligence Endpoints
# 7 endpoints that gather real DB data and send structured prompts to Claude
# ============================================================================

import os
import json
import httpx

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
from collections import Counter

from database.connection import get_db
from database.models import (
    Client, VisitHistory, Staff, Service, Appointment, Tenant,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid, now_colombia

router = APIRouter()

# ============================================================================
# SHARED — Call Claude and parse JSON response
# ============================================================================

_MODEL = "claude-sonnet-4-20250514"
_API_URL = "https://api.anthropic.com/v1/messages"


def _call_strategy_ai(system_prompt: str, user_message: str, tenant_id: int = 1, max_tokens: int = 4096) -> dict:
    """Call Claude with a structured prompt and parse the JSON response."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise HTTPException(status_code=503, detail="API key de IA no configurada")

    payload = {
        "model": _MODEL,
        "max_tokens": max_tokens,
        "system": [{"type": "text", "text": system_prompt, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user_message}],
        "temperature": 0.4,
    }
    headers = {
        "x-api-key": anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=90.0) as client:
            response = client.post(_API_URL, json=payload, headers=headers)
            response.raise_for_status()
    except httpx.HTTPStatusError as e:
        print(f"[AI Strategy] Claude HTTP error: {e.response.status_code} — {e.response.text[:300]}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")
    except Exception as e:
        print(f"[AI Strategy] Claude error: {e}")
        raise HTTPException(status_code=502, detail="Error al comunicarse con el servicio de IA")

    result = response.json()

    # Track usage
    tokens = result.get("usage", {}).get("input_tokens", 0) + result.get("usage", {}).get("output_tokens", 0)
    try:
        from routes._usage_tracker import track_ai_usage
        track_ai_usage(tokens, tenant_id=tenant_id)
    except Exception:
        pass

    # Extract text
    text = ""
    for block in result.get("content", []):
        if block.get("type") == "text":
            text += block.get("text", "")

    # Parse JSON from response — look for ```json block first, then raw JSON
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
        # Return raw text wrapped in a dict
        return {"raw_response": text}


def _get_tenant_name(db: Session, tid: int) -> str:
    """Get the tenant business name."""
    if not tid:
        return "el negocio"
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    return tenant.name if tenant else "el negocio"


def _get_business_context(db: Session, tid: int) -> str:
    """Get the business context from AIConfig prompt + tenant info."""
    from database.models import AIConfig
    biz_name = _get_tenant_name(db, tid)
    ai_config = db.query(AIConfig).filter(AIConfig.tenant_id == tid, AIConfig.is_active == True).first()
    prompt = ai_config.system_prompt[:1500] if ai_config and ai_config.system_prompt else ""
    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    city = tenant.city if tenant else ""
    country = tenant.country if tenant else "CO"
    btype = tenant.business_type if tenant else ""
    return f"NEGOCIO: {biz_name}\nTIPO: {btype}\nCIUDAD: {city}, {country}\n\nCONTEXTO:\n{prompt}"


_STRATEGY_RULES = """
REGLAS PARA TODAS LAS RESPUESTAS:
- Español colombiano, tono profesional y cercano
- NO pongas precios en pesos. Usa porcentajes (15% descuento, 2x1, etc.)
- Se conciso. Maximo 3-4 oraciones por seccion
- Si generas un mensaje de campaña, que sea para WhatsApp (max 500 chars, sin hashtags)
- Siempre termina con una campaña/mensaje recomendado listo para enviar
- Responde SOLO con JSON valido (sin texto adicional fuera del JSON)
"""


# ============================================================================
# 1. POST /ai/strategy/generate-campaign
# ============================================================================

@router.post("/ai/strategy/generate-campaign")
def generate_campaign(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    three_months_ago = today - timedelta(days=90)
    biz_name = _get_tenant_name(db, tid)

    # Visits last 3 months
    visits = (
        db.query(VisitHistory)
        .filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.status == "completed",
            VisitHistory.visit_date >= three_months_ago,
        )
        .all()
    )

    # Aggregate by service
    service_stats = {}
    for v in visits:
        sn = v.service_name or "Sin nombre"
        if sn not in service_stats:
            service_stats[sn] = {"count": 0, "revenue": 0}
        service_stats[sn]["count"] += 1
        service_stats[sn]["revenue"] += v.amount or 0

    # Client segments
    clients = db.query(Client).filter(Client.tenant_id == tid, Client.is_active == True).all()
    segments = Counter()
    for c in clients:
        last = (
            db.query(func.max(VisitHistory.visit_date))
            .filter(VisitHistory.client_id == c.id, VisitHistory.status == "completed")
            .scalar()
        )
        if last is None:
            segments["nuevos_sin_visita"] += 1
        elif (today - last).days > 90:
            segments["inactivos_90d"] += 1
        elif (today - last).days > 30:
            segments["en_riesgo_30_90d"] += 1
        else:
            segments["activos"] += 1

    # Current month and season context
    month_names = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio",
                   "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    current_month = month_names[today.month]

    # Get business context from AIConfig prompt
    from database.models import AIConfig
    ai_config = db.query(AIConfig).filter(AIConfig.tenant_id == tid, AIConfig.is_active == True).first()
    business_context = ai_config.system_prompt if ai_config and ai_config.system_prompt else "No hay contexto del negocio configurado."

    data_context = f"""
CONTEXTO DEL NEGOCIO (prompt del admin):
{business_context[:1500]}

NEGOCIO: {biz_name}
FECHA ACTUAL: {today.isoformat()} ({current_month} {today.year})
PAIS: Colombia

SERVICIOS ULTIMOS 3 MESES (nombre | demanda | ingresos):
{chr(10).join(f"- {s}: {d['count']} veces, ${d['revenue']:,}" for s, d in sorted(service_stats.items(), key=lambda x: -x[1]['count'])[:15])}

CLIENTES (total: {len(clients)}):
- Activos: {segments.get('activos', 0)}
- En riesgo: {segments.get('en_riesgo_30_90d', 0)}
- Inactivos 90d+: {segments.get('inactivos_90d', 0)}
"""

    system = f"""Eres el director creativo de la mejor agencia de marketing digital de Colombia, especializado en negocios de servicios.
IMPORTANTE: Lee el CONTEXTO DEL NEGOCIO — tipo de negocio, ubicacion, servicios que ofrece, tono de comunicacion.

Tu trabajo:
1. Identifica que fecha importante, tendencia o temporada hay en {current_month} {today.year} en Colombia que el negocio pueda aprovechar (Semana Santa, dia de la madre, Black Friday, tendencias de belleza/moda en redes, etc.)
2. Analiza cuales son los servicios estrella del negocio y que audiencia tiene
3. Crea UNA campana de WhatsApp que sea IRRESISTIBLE — como si la hubiera hecho una agencia premium

REGLAS PARA LA CAMPANA:
- NO pongas precios en pesos. Usa porcentajes de descuento o beneficios (15% off, 2x1, gratis, etc.)
- El mensaje debe ser EMOCIONAL, no informativo. Que el cliente SIENTA que se pierde algo si no viene
- Maximo 400 caracteres. Cada palabra cuenta
- Un solo emoji estrategico al inicio, no mas
- Sin hashtags
- Tono FORMAL y profesional. Usa "usted" (le invitamos, lo esperamos, le ofrecemos). NUNCA uses tuteo (tu, quieres) ni voseo argentino (vos, querés). Lenguaje respetuoso y elegante de negocio colombiano
- Incluye una llamada a la accion clara y simple ("Responde SI y te agendo")
- El mensaje debe funcionar por SI SOLO sin contexto adicional

Responde SOLO con JSON valido:
{{
  "tendencia": "Que oportunidad hay en {current_month} para este negocio (1 oracion concreta)",
  "por_que": "Por que esta campana va a funcionar para ESTE negocio especifico (1 oracion)",
  "campana": "El mensaje de WhatsApp PERFECTO — emocional, corto, con llamada a la accion",
  "audiencia": "A quienes enviarla (1 oracion)"
}}"""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 2. POST /ai/strategy/business-diagnostics
# ============================================================================

@router.post("/ai/strategy/business-diagnostics")
def business_diagnostics(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    biz_name = _get_tenant_name(db, tid)

    # Revenue by month (last 6 months)
    six_months_ago = today - timedelta(days=180)
    visits = (
        db.query(VisitHistory)
        .filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.status == "completed",
            VisitHistory.visit_date >= six_months_ago,
        )
        .all()
    )

    monthly_revenue = {}
    for v in visits:
        key = v.visit_date.strftime("%Y-%m")
        monthly_revenue[key] = monthly_revenue.get(key, 0) + (v.amount or 0)

    # Revenue by service
    by_service = {}
    for v in visits:
        sn = v.service_name or "Sin nombre"
        if sn not in by_service:
            by_service[sn] = {"count": 0, "revenue": 0}
        by_service[sn]["count"] += 1
        by_service[sn]["revenue"] += v.amount or 0

    # Revenue by staff
    by_staff = {}
    for v in visits:
        sid = v.staff_id
        if sid not in by_staff:
            staff_obj = db.query(Staff).filter(Staff.id == sid).first()
            by_staff[sid] = {"name": staff_obj.name if staff_obj else f"ID {sid}", "count": 0, "revenue": 0}
        by_staff[sid]["count"] += 1
        by_staff[sid]["revenue"] += v.amount or 0

    # Appointments by hour and day (last 3 months)
    three_months_ago = today - timedelta(days=90)
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tid,
            Appointment.date >= three_months_ago,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        .all()
    )

    by_hour = Counter()
    by_day = Counter()
    days_es = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
    for a in appointments:
        try:
            hour = int(a.time.split(":")[0])
            by_hour[f"{hour:02d}:00"] += 1
        except (ValueError, AttributeError):
            pass
        by_day[days_es[a.date.weekday()]] += 1

    # Client retention
    total_clients = db.query(Client).filter(Client.tenant_id == tid, Client.is_active == True).count()
    returning = (
        db.query(VisitHistory.client_id)
        .filter(VisitHistory.tenant_id == tid, VisitHistory.status == "completed")
        .group_by(VisitHistory.client_id)
        .having(func.count(VisitHistory.id) >= 2)
        .count()
    )
    retention_pct = round((returning / total_clients * 100), 1) if total_clients > 0 else 0

    # Average ticket
    total_revenue = sum(v.amount or 0 for v in visits)
    total_visits_count = len(visits)
    avg_ticket = total_revenue // total_visits_count if total_visits_count > 0 else 0

    data_context = f"""
NEGOCIO: {biz_name}
PERIODO ANALIZADO: {six_months_ago.isoformat()} a {today.isoformat()}

INGRESOS POR MES:
{chr(10).join(f"- {m}: ${r:,} COP" for m, r in sorted(monthly_revenue.items()))}

INGRESOS POR SERVICIO:
{chr(10).join(f"- {s}: {d['count']} servicios, ${d['revenue']:,} COP" for s, d in sorted(by_service.items(), key=lambda x: -x[1]['revenue']))}

INGRESOS POR PROFESIONAL:
{chr(10).join(f"- {d['name']}: {d['count']} servicios, ${d['revenue']:,} COP" for d in sorted(by_staff.values(), key=lambda x: -x['revenue']))}

CITAS POR HORA:
{chr(10).join(f"- {h}: {c} citas" for h, c in sorted(by_hour.items()))}

CITAS POR DIA:
{chr(10).join(f"- {d}: {c} citas" for d, c in sorted(by_day.items(), key=lambda x: -x[1]))}

METRICAS CLAVE:
- Total clientes activos: {total_clients}
- Clientes recurrentes (2+ visitas): {returning}
- Tasa de retencion: {retention_pct}%
- Ticket promedio: ${avg_ticket:,} COP
- Total ingresos periodo: ${total_revenue:,} COP
- Total servicios realizados: {total_visits_count}
"""

    system = """Eres un consultor de negocios experto en la industria de belleza y servicios personales en Colombia.
Responde SOLO en español colombiano. Responde UNICAMENTE con un JSON valido (sin texto adicional).

El JSON debe tener esta estructura:
```json
{
  "summary": "Resumen ejecutivo del estado del negocio (2-3 parrafos)",
  "revenue_trend": "Analisis de la tendencia de ingresos",
  "top_services": ["Servicio mas rentable 1", "Servicio 2", "Servicio 3"],
  "dead_hours": ["Hora muerta 1 con explicacion", "Hora muerta 2"],
  "recommendations": [
    {"title": "Titulo accion 1", "description": "Que hacer y por que", "priority": "alta"},
    {"title": "Titulo accion 2", "description": "Que hacer y por que", "priority": "media"},
    {"title": "Titulo accion 3", "description": "Que hacer y por que", "priority": "baja"}
  ]
}
```"""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 3. POST /ai/strategy/rescue-lost-clients
# ============================================================================

@router.post("/ai/strategy/rescue-lost-clients")
def rescue_lost_clients(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    biz_name = _get_tenant_name(db, tid)

    # Clients with last visit > 30 days ago
    clients = db.query(Client).filter(Client.tenant_id == tid, Client.is_active == True).all()

    lost_clients = []
    for c in clients:
        last_visit_row = (
            db.query(VisitHistory)
            .filter(VisitHistory.client_id == c.id, VisitHistory.status == "completed")
            .order_by(VisitHistory.visit_date.desc())
            .first()
        )
        if not last_visit_row:
            continue

        days_inactive = (today - last_visit_row.visit_date).days
        if days_inactive < 30:
            continue

        # Get their history
        all_visits = (
            db.query(VisitHistory)
            .filter(VisitHistory.client_id == c.id, VisitHistory.status == "completed")
            .all()
        )
        total_spent = sum(v.amount or 0 for v in all_visits)
        services_used = list(set(v.service_name for v in all_visits if v.service_name))

        # Last staff
        staff_obj = db.query(Staff).filter(Staff.id == last_visit_row.staff_id).first()
        staff_name = staff_obj.name if staff_obj else "Desconocido"

        lost_clients.append({
            "name": c.name,
            "phone": c.phone,
            "days_inactive": days_inactive,
            "total_visits": len(all_visits),
            "total_spent": total_spent,
            "last_service": last_visit_row.service_name,
            "last_staff": staff_name,
            "services_used": services_used[:5],
        })

    # Sort by spend descending — most valuable first
    lost_clients.sort(key=lambda x: -x["total_spent"])

    # Limit to top 30 for the prompt
    top_lost = lost_clients[:30]

    biz_context = _get_business_context(db, tid)
    data_context = f"""
{biz_context}

TOTAL CLIENTES PERDIDOS (30+ dias sin visita): {len(lost_clients)}
TOP {len(top_lost)} POR VALOR:

{chr(10).join(f"- {c['name']} | {c['days_inactive']}d inactivo | {c['total_visits']} visitas | ${c['total_spent']:,} | Ultimo: {c['last_service']} con {c['last_staff']}" for c in top_lost)}
"""

    system = f"""Eres el mejor especialista en retencion de clientes de Colombia.
Lee el contexto del negocio para entender que tipo de negocio es.

{_STRATEGY_RULES}

Analiza los clientes perdidos y genera:
1. Un resumen rapido de la situacion
2. Los 5 clientes MAS valiosos que hay que recuperar PRIMERO (con plan personalizado)
3. UNA campana de WhatsApp para enviarles a TODOS — emocional, irresistible, sin precios en pesos

JSON:
{{
  "resumen": "Situacion de clientes perdidos en 1-2 oraciones",
  "clientes_prioritarios": [
    {{"nombre": "X", "dias_inactivo": N, "ultimo_servicio": "X", "profesional": "X", "total_gastado": N, "plan": "Que hacer para recuperarlo (1 oracion)"}}
  ],
  "campana_recuperacion": "Mensaje de WhatsApp listo para enviar a todos los perdidos (max 400 chars, emocional, con llamada a la accion)"
}}"""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 4. POST /ai/strategy/price-optimizer
# ============================================================================

@router.post("/ai/strategy/price-optimizer")
def price_optimizer(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    biz_name = _get_tenant_name(db, tid)
    three_months_ago = today - timedelta(days=90)

    # All active services
    services = db.query(Service).filter(Service.tenant_id == tid, Service.is_active == True).all()

    # Visit frequency & revenue per service (last 3 months)
    visits = (
        db.query(VisitHistory)
        .filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.status == "completed",
            VisitHistory.visit_date >= three_months_ago,
        )
        .all()
    )

    visit_stats = {}
    for v in visits:
        sn = v.service_name or "Sin nombre"
        if sn not in visit_stats:
            visit_stats[sn] = {"count": 0, "revenue": 0}
        visit_stats[sn]["count"] += 1
        visit_stats[sn]["revenue"] += v.amount or 0

    service_data = []
    for s in services:
        stats = visit_stats.get(s.name, {"count": 0, "revenue": 0})
        service_data.append({
            "name": s.name,
            "category": s.category,
            "price": s.price,
            "duration": s.duration_minutes,
            "demand_3m": stats["count"],
            "revenue_3m": stats["revenue"],
        })

    # Sort by revenue desc
    service_data.sort(key=lambda x: -x["revenue_3m"])

    data_context = f"""
NEGOCIO: {biz_name}
PERIODO: ultimos 3 meses ({three_months_ago.isoformat()} a {today.isoformat()})

SERVICIOS (nombre | categoria | precio actual | duracion min | demanda 3 meses | ingresos 3 meses):
{chr(10).join(f"- {s['name']} | {s['category']} | ${s['price']:,} COP | {s['duration'] or '?'} min | {s['demand_3m']} veces | ${s['revenue_3m']:,} COP" for s in service_data)}
"""

    system = """Eres un consultor de pricing experto en negocios de servicios de belleza en Colombia.
Analiza la relacion precio-demanda de cada servicio y sugiere ajustes.
Responde SOLO en español colombiano. Responde UNICAMENTE con un JSON valido (sin texto adicional).

El JSON debe tener esta estructura:
```json
{
  "services": [
    {
      "name": "Nombre del servicio",
      "current_price": 25000,
      "demand": "alta/media/baja",
      "suggestion": "Subir a $30,000 / Mantener / Crear combo",
      "reasoning": "Justificacion basada en datos"
    }
  ]
}
```
Incluye TODOS los servicios listados."""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 5. POST /ai/strategy/predict-agenda
# ============================================================================

class PredictAgendaRequest(BaseModel):
    week_start: Optional[str] = None  # YYYY-MM-DD, defaults to next Monday


@router.post("/ai/strategy/predict-agenda")
def predict_agenda(body: PredictAgendaRequest = None, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    biz_name = _get_tenant_name(db, tid)

    # Parse target week
    if body and body.week_start:
        try:
            target_start = date.fromisoformat(body.week_start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha invalido. Usa YYYY-MM-DD")
    else:
        # Next Monday
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        target_start = today + timedelta(days=days_until_monday)

    target_end = target_start + timedelta(days=6)

    # Historical data: last 8 weeks
    eight_weeks_ago = today - timedelta(weeks=8)
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tid,
            Appointment.date >= eight_weeks_ago,
            Appointment.date <= today,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        .all()
    )

    days_es = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

    # Group by weekday
    by_weekday = {d: [] for d in days_es}
    for a in appointments:
        day_name = days_es[a.date.weekday()]
        service_obj = db.query(Service).filter(Service.id == a.service_id).first()
        staff_obj = db.query(Staff).filter(Staff.id == a.staff_id).first()
        by_weekday[day_name].append({
            "service": service_obj.name if service_obj else "Desconocido",
            "staff": staff_obj.name if staff_obj else "Desconocido",
            "hour": a.time,
        })

    # Summary per day
    day_summaries = []
    for day_name in days_es:
        items = by_weekday[day_name]
        if not items:
            day_summaries.append(f"- {day_name}: 0 citas registradas en 8 semanas")
            continue
        service_counts = Counter(i["service"] for i in items)
        staff_counts = Counter(i["staff"] for i in items)
        avg_per_week = len(items) / 8
        top_services = ", ".join(f"{s}({c})" for s, c in service_counts.most_common(3))
        top_staff = ", ".join(f"{s}({c})" for s, c in staff_counts.most_common(3))
        day_summaries.append(f"- {day_name}: {len(items)} citas (prom {avg_per_week:.1f}/semana) | Servicios: {top_services} | Staff: {top_staff}")

    # Staff available
    active_staff = db.query(Staff).filter(Staff.tenant_id == tid, Staff.is_active == True).all()
    staff_names = [s.name for s in active_staff]

    data_context = f"""
NEGOCIO: {biz_name}
SEMANA A PREDECIR: {target_start.isoformat()} a {target_end.isoformat()}
DATOS HISTORICOS: ultimas 8 semanas ({eight_weeks_ago.isoformat()} a {today.isoformat()})
STAFF ACTIVO: {', '.join(staff_names)}

PATRONES POR DIA (total 8 semanas):
{chr(10).join(day_summaries)}
"""

    system = """Eres un analista de datos especializado en prediccion de demanda para negocios de belleza.
Basandote en los patrones historicos, predice la agenda de la semana solicitada.
Responde SOLO en español colombiano. Responde UNICAMENTE con un JSON valido (sin texto adicional).

El JSON debe tener esta estructura:
```json
{
  "predictions": [
    {
      "day": "Lunes",
      "date": "2026-03-23",
      "expected_appointments": 8,
      "services_breakdown": {"Corte clasico": 4, "Barba": 2, "Tinte": 2},
      "staff_needed": ["Staff 1", "Staff 2"],
      "peak_hours": ["10:00-12:00", "15:00-17:00"],
      "notes": "Observacion relevante"
    }
  ]
}
```
Incluye los 7 dias de la semana (Lunes a Domingo)."""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 6. POST /ai/strategy/growth-plan
# ============================================================================

@router.post("/ai/strategy/growth-plan")
def growth_plan(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    today = now_colombia().date()
    biz_name = _get_tenant_name(db, tid)

    # Revenue last 6 months
    six_months_ago = today - timedelta(days=180)
    visits = (
        db.query(VisitHistory)
        .filter(
            VisitHistory.tenant_id == tid,
            VisitHistory.status == "completed",
            VisitHistory.visit_date >= six_months_ago,
        )
        .all()
    )

    monthly_revenue = {}
    monthly_clients = {}
    for v in visits:
        key = v.visit_date.strftime("%Y-%m")
        monthly_revenue[key] = monthly_revenue.get(key, 0) + (v.amount or 0)
        if key not in monthly_clients:
            monthly_clients[key] = set()
        monthly_clients[key].add(v.client_id)

    # Client growth
    total_clients = db.query(Client).filter(Client.tenant_id == tid, Client.is_active == True).count()
    new_last_month = (
        db.query(Client)
        .filter(
            Client.tenant_id == tid,
            Client.is_active == True,
            Client.created_at >= (today - timedelta(days=30)),
        )
        .count()
    )

    # Retention
    returning = (
        db.query(VisitHistory.client_id)
        .filter(VisitHistory.tenant_id == tid, VisitHistory.status == "completed")
        .group_by(VisitHistory.client_id)
        .having(func.count(VisitHistory.id) >= 2)
        .count()
    )
    retention_pct = round((returning / total_clients * 100), 1) if total_clients > 0 else 0

    # Avg ticket
    total_revenue = sum(v.amount or 0 for v in visits)
    total_count = len(visits)
    avg_ticket = total_revenue // total_count if total_count > 0 else 0

    # Top services
    service_counts = Counter(v.service_name for v in visits if v.service_name)
    top_services = service_counts.most_common(5)

    data_context = f"""
NEGOCIO: {biz_name}
FECHA: {today.isoformat()}

INGRESOS POR MES (ultimos 6 meses):
{chr(10).join(f"- {m}: ${r:,} COP ({len(monthly_clients.get(m, set()))} clientes unicos)" for m, r in sorted(monthly_revenue.items()))}

METRICAS:
- Total clientes: {total_clients}
- Nuevos ultimo mes: {new_last_month}
- Tasa de retencion: {retention_pct}%
- Ticket promedio: ${avg_ticket:,} COP
- Ingresos totales 6 meses: ${total_revenue:,} COP

TOP 5 SERVICIOS:
{chr(10).join(f"- {s}: {c} veces" for s, c in top_services)}
"""

    system = """Eres un consultor de crecimiento empresarial especializado en negocios de belleza en Latinoamerica.
Genera un plan de crecimiento mensual con KPIs medibles y acciones concretas.
Responde SOLO en español colombiano. Responde UNICAMENTE con un JSON valido (sin texto adicional).

El JSON debe tener esta estructura:
```json
{
  "current_state": "Diagnostico actual del negocio (2-3 oraciones)",
  "goals": {
    "revenue_target": "Meta de ingresos mensual con justificacion",
    "client_target": "Meta de nuevos clientes",
    "retention_target": "Meta de retencion"
  },
  "action_plan": [
    {
      "week": 1,
      "action": "Accion concreta",
      "expected_impact": "Impacto esperado",
      "responsible": "Quien lo ejecuta"
    }
  ],
  "kpis": [
    {
      "metric": "Nombre del KPI",
      "current_value": "Valor actual",
      "target_value": "Meta",
      "how_to_measure": "Como medirlo"
    }
  ]
}
```"""

    return _call_strategy_ai(system, data_context, tenant_id=tid)


# ============================================================================
# 7. POST /ai/strategy/staff-retention
# ============================================================================

class StaffRetentionRequest(BaseModel):
    staff_id: int
    offer_description: str


@router.post("/ai/strategy/staff-retention")
def staff_retention(body: StaffRetentionRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant no identificado")

    biz_name = _get_tenant_name(db, tid)
    today = now_colombia().date()

    # Get the staff member
    staff_member = db.query(Staff).filter(Staff.id == body.staff_id).first()
    if not staff_member:
        raise HTTPException(status_code=404, detail="Profesional no encontrado")

    staff_name = staff_member.name

    # All appointments by this staff member
    appointments = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tid,
            Appointment.staff_id == body.staff_id,
            Appointment.status.in_(["confirmed", "completed"]),
        )
        .all()
    )

    # Unique clients from appointments
    client_ids = set(a.client_id for a in appointments if a.client_id)

    client_details = []
    for cid in client_ids:
        client_obj = db.query(Client).filter(Client.id == cid).first()
        if not client_obj:
            continue

        # Visits with this specific staff
        client_visits = (
            db.query(VisitHistory)
            .filter(
                VisitHistory.client_id == cid,
                VisitHistory.staff_id == body.staff_id,
                VisitHistory.status == "completed",
            )
            .order_by(VisitHistory.visit_date.desc())
            .all()
        )

        total_spent = sum(v.amount or 0 for v in client_visits)
        last_visit = client_visits[0].visit_date if client_visits else None
        services_used = list(set(v.service_name for v in client_visits if v.service_name))

        client_details.append({
            "name": client_obj.name,
            "phone": client_obj.phone,
            "visits_with_staff": len(client_visits),
            "total_spent": total_spent,
            "last_visit": last_visit.isoformat() if last_visit else "N/A",
            "services": services_used[:5],
        })

    # Sort by value
    client_details.sort(key=lambda x: -x["total_spent"])

    # Limit to top 30
    top_clients = client_details[:30]

    data_context = f"""
NEGOCIO: {biz_name}
PROFESIONAL QUE SE FUE: {staff_name}
OFERTA/PROMO PARA RETENER CLIENTES: {body.offer_description}

TOTAL CLIENTES ATENDIDOS POR {staff_name}: {len(client_details)}

TOP {len(top_clients)} CLIENTES POR VALOR (nombre | visitas con este profesional | gasto | ultima visita | servicios):
{chr(10).join(f"- {c['name']} | {c['visits_with_staff']} visitas | ${c['total_spent']:,} COP | {c['last_visit']} | {', '.join(c['services'])}" for c in top_clients)}
"""

    system = (
        f"Eres un especialista en retencion de clientes para negocios de servicios en Colombia. "
        f"Un profesional ({staff_name}) se fue del negocio. Genera un plan para retener a sus clientes usando la oferta: {body.offer_description}. "
        f"Responde SOLO en español colombiano. Responde UNICAMENTE con JSON valido. "
        f"REGLAS: NO precios en pesos (usa porcentajes). Campana max 400 chars, emocional, con llamada a la accion. "
        f"JSON: {{\"resumen\": \"Situacion en 1 oracion\", \"staff_name\": \"{staff_name}\", \"total_clientes\": {len(client_details)}, "
        f"\"clientes_prioritarios\": [{{\"nombre\": \"X\", \"visitas\": N, \"gastado\": N, \"plan\": \"1 oracion\"}}], "
        f"\"campana_retencion\": \"Mensaje WhatsApp listo para enviar (max 400 chars)\"}}"
    )

    return _call_strategy_ai(system, data_context, tenant_id=tid)
