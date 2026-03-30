"""
Client Intelligence Engine — Predictive analytics for service businesses.

Calculates: visit cycles, churn risk scores, no-show risk per appointment,
revenue forecasting, and proactive reconnect recommendations.
"""

from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
from collections import Counter
from database.connection import SessionLocal
from database.models import Client, VisitHistory, Appointment, Staff, Service, ClientNote
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# VISIT CYCLE CALCULATOR
# ============================================================================

def calculate_visit_cycle(client_id: int, db=None) -> Dict:
    """Calculate a client's average visit cycle (days between visits).

    Returns: {
        avg_cycle_days: int or None,
        visits_analyzed: int,
        last_visit_date: date or None,
        days_since_last: int or None,
        cycle_status: "on_track" | "overdue" | "critical" | "new" | "unknown"
    }
    """
    _close_db = False
    if db is None:
        db = SessionLocal()
        _close_db = True

    try:
        visits = (
            db.query(VisitHistory)
            .filter(
                VisitHistory.client_id == client_id,
                VisitHistory.status == "completed",
            )
            .order_by(VisitHistory.visit_date.desc())
            .limit(20)
            .all()
        )

        if len(visits) < 2:
            last_date = visits[0].visit_date if visits else None
            days_since = (date.today() - last_date).days if last_date else None
            return {
                "avg_cycle_days": None,
                "visits_analyzed": len(visits),
                "last_visit_date": last_date,
                "days_since_last": days_since,
                "cycle_status": "new" if len(visits) <= 1 else "unknown",
            }

        # Calculate gaps between consecutive visits
        dates = sorted([v.visit_date for v in visits])
        gaps = []
        for i in range(1, len(dates)):
            gap = (dates[i] - dates[i - 1]).days
            if gap > 0:  # Ignore same-day visits
                gaps.append(gap)

        if not gaps:
            return {
                "avg_cycle_days": None,
                "visits_analyzed": len(visits),
                "last_visit_date": dates[-1],
                "days_since_last": (date.today() - dates[-1]).days,
                "cycle_status": "unknown",
            }

        avg_cycle = round(sum(gaps) / len(gaps))
        last_visit = dates[-1]
        days_since = (date.today() - last_visit).days

        # Determine status
        if avg_cycle == 0:
            status = "unknown"
        elif days_since <= avg_cycle * 1.2:
            status = "on_track"
        elif days_since <= avg_cycle * 1.5:
            status = "overdue"
        else:
            status = "critical"

        return {
            "avg_cycle_days": avg_cycle,
            "visits_analyzed": len(visits),
            "last_visit_date": last_visit,
            "days_since_last": days_since,
            "cycle_status": status,
        }
    finally:
        if _close_db:
            db.close()


# ============================================================================
# CLIENT RISK SCORE (0-100)
# ============================================================================

def calculate_risk_score(client_id: int, db=None) -> Dict:
    """Calculate churn risk score for a client (0=safe, 100=about to churn).

    Factors:
    - Days overdue from visit cycle (+40 max)
    - No-show history (+20 max)
    - Spending decline (+20 max)
    - No visits ever (+20)
    """
    _close_db = False
    if db is None:
        db = SessionLocal()
        _close_db = True

    try:
        score = 0
        factors = []

        cycle = calculate_visit_cycle(client_id, db)

        # Factor 1: Days overdue (max +40)
        if cycle["avg_cycle_days"] and cycle["days_since_last"]:
            overdue_ratio = cycle["days_since_last"] / cycle["avg_cycle_days"]
            if overdue_ratio > 1.0:
                overdue_score = min(40, int((overdue_ratio - 1.0) * 30))
                score += overdue_score
                factors.append(f"Lleva {cycle['days_since_last']}d sin venir (ciclo: {cycle['avg_cycle_days']}d)")
        elif cycle["days_since_last"] and cycle["days_since_last"] > 45:
            # No cycle calculated but hasn't visited in a while
            score += min(30, cycle["days_since_last"] // 3)
            factors.append(f"Lleva {cycle['days_since_last']}d sin venir (sin ciclo calculado)")

        # Factor 2: No-show history (max +20)
        visits = (
            db.query(VisitHistory)
            .filter(VisitHistory.client_id == client_id)
            .all()
        )
        no_shows = sum(1 for v in visits if v.status == "no_show")
        if no_shows > 0:
            noshow_score = min(20, no_shows * 7)
            score += noshow_score
            factors.append(f"{no_shows} no-show(s) registrados")

        # Factor 3: Spending decline (max +20)
        completed_visits = sorted(
            [v for v in visits if v.status == "completed" and v.amount],
            key=lambda v: v.visit_date,
        )
        if len(completed_visits) >= 4:
            half = len(completed_visits) // 2
            recent_avg = sum(v.amount for v in completed_visits[half:]) / len(completed_visits[half:])
            old_avg = sum(v.amount for v in completed_visits[:half]) / len(completed_visits[:half])
            if old_avg > 0 and recent_avg < old_avg * 0.7:
                decline_pct = int((1 - recent_avg / old_avg) * 100)
                score += min(20, decline_pct // 3)
                factors.append(f"Gasto bajo {decline_pct}% vs historial")

        # Factor 4: Never visited (max +20)
        if cycle["visits_analyzed"] == 0:
            score += 20
            factors.append("Nunca ha visitado el negocio")

        return {
            "risk_score": min(100, score),
            "risk_level": "alto" if score >= 60 else "medio" if score >= 30 else "bajo",
            "factors": factors,
            "visit_cycle": cycle,
        }
    finally:
        if _close_db:
            db.close()


# ============================================================================
# NO-SHOW RISK PER APPOINTMENT (0-100)
# ============================================================================

def calculate_noshow_risk(appointment_id: int, db=None) -> Dict:
    """Calculate no-show probability for a specific appointment.

    Factors:
    - Client's no-show history (+30 max)
    - Day of week (Mon/Fri higher risk) (+10)
    - First/last slot of day (+10)
    - Not confirmed yet (+20)
    - New client (+15)
    - Created very recently for today (+15)
    """
    _close_db = False
    if db is None:
        db = SessionLocal()
        _close_db = True

    try:
        apt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not apt:
            return {"risk_score": 0, "factors": []}

        score = 0
        factors = []

        # Factor 1: Client no-show history (max +30)
        if apt.client_id:
            client_visits = db.query(VisitHistory).filter(
                VisitHistory.client_id == apt.client_id
            ).all()
            total = len(client_visits)
            no_shows = sum(1 for v in client_visits if v.status == "no_show")
            if total > 0 and no_shows > 0:
                rate = no_shows / total
                ns_score = min(30, int(rate * 60))
                score += ns_score
                factors.append(f"Historial: {no_shows}/{total} no-shows ({int(rate*100)}%)")

        # Factor 2: Day of week (max +10)
        if apt.date:
            dow = apt.date.weekday()  # 0=Mon, 4=Fri
            if dow in (0, 4):  # Monday or Friday
                score += 10
                day_name = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"][dow]
                factors.append(f"{day_name} tiene mayor tasa de inasistencia")

        # Factor 3: First/last slot (max +10)
        if apt.time:
            try:
                hour = int(apt.time.split(":")[0])
                if hour <= 8 or hour >= 18:
                    score += 10
                    factors.append("Horario extremo (primera/ultima hora)")
            except ValueError:
                pass

        # Factor 4: Not confirmed (max +20)
        if apt.status == "confirmed":
            # "confirmed" is actually the default/pending state
            # If there's no explicit confirmation from client, add risk
            score += 10
            factors.append("Sin confirmacion explicita del cliente")

        # Factor 5: New client (max +15)
        if apt.client_id:
            visit_count = db.query(VisitHistory).filter(
                VisitHistory.client_id == apt.client_id,
                VisitHistory.status == "completed",
            ).count()
            if visit_count == 0:
                score += 15
                factors.append("Cliente nuevo (primera visita)")

        return {
            "risk_score": min(100, score),
            "risk_level": "alto" if score >= 60 else "medio" if score >= 30 else "bajo",
            "factors": factors,
        }
    finally:
        if _close_db:
            db.close()


# ============================================================================
# REVENUE FORECAST
# ============================================================================

def forecast_revenue(tenant_id: int, days: int = 7, db=None) -> Dict:
    """Forecast revenue based on confirmed/paid appointments + historical average."""
    _close_db = False
    if db is None:
        db = SessionLocal()
        _close_db = True

    try:
        today = date.today()
        end = today + timedelta(days=days)

        # Confirmed upcoming appointments
        upcoming = (
            db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant_id,
                Appointment.date >= today,
                Appointment.date <= end,
                Appointment.status.in_(["confirmed", "paid", "completed"]),
            )
            .all()
        )

        confirmed_revenue = sum(a.price or 0 for a in upcoming)
        confirmed_count = len(upcoming)

        # Historical average daily revenue (last 30 days)
        thirty_ago = today - timedelta(days=30)
        hist_apts = (
            db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant_id,
                Appointment.date >= thirty_ago,
                Appointment.date < today,
                Appointment.status.in_(["completed", "paid"]),
            )
            .all()
        )

        hist_total = sum(a.price or 0 for a in hist_apts)
        hist_days = max(1, (today - thirty_ago).days)
        daily_avg = hist_total / hist_days

        # Projected = confirmed + (remaining unbooked days * daily_avg * walk-in factor)
        booked_dates = set(a.date for a in upcoming)
        unbooked_days = sum(1 for d in range(days) if (today + timedelta(days=d)) not in booked_dates)
        walk_in_estimate = int(unbooked_days * daily_avg * 0.3)  # 30% of avg for walk-ins

        return {
            "period_days": days,
            "confirmed_revenue": confirmed_revenue,
            "confirmed_appointments": confirmed_count,
            "daily_avg_historical": int(daily_avg),
            "walk_in_estimate": walk_in_estimate,
            "total_forecast": confirmed_revenue + walk_in_estimate,
        }
    finally:
        if _close_db:
            db.close()


# ============================================================================
# RECONNECT CANDIDATES (clients overdue for visit)
# ============================================================================

def get_reconnect_candidates(tenant_id: int, limit: int = 20, db=None) -> List[Dict]:
    """Find clients who are overdue for a visit based on their personal cycle."""
    _close_db = False
    if db is None:
        db = SessionLocal()
        _close_db = True

    try:
        clients = (
            db.query(Client)
            .filter(Client.tenant_id == tenant_id, Client.is_active == True)
            .all()
        )

        candidates = []
        for client in clients:
            cycle = calculate_visit_cycle(client.id, db)
            if cycle["cycle_status"] in ("overdue", "critical"):
                # Check we haven't already sent a reconnect this month
                month_ago = date.today() - timedelta(days=30)
                recent_reconnect = (
                    db.query(ClientNote)
                    .filter(
                        ClientNote.client_id == client.id,
                        ClientNote.content.like("%RECONNECT%"),
                        ClientNote.created_at >= datetime.combine(month_ago, datetime.min.time()),
                    )
                    .first()
                )
                if recent_reconnect:
                    continue  # Already sent this month

                # Get preferred staff
                preferred_staff = None
                if client.preferred_barber:
                    preferred_staff = client.preferred_barber.name

                candidates.append({
                    "client_id": client.id,
                    "client_name": client.name,
                    "phone": client.phone,
                    "avg_cycle": cycle["avg_cycle_days"],
                    "days_since": cycle["days_since_last"],
                    "cycle_status": cycle["cycle_status"],
                    "preferred_staff": preferred_staff,
                    "favorite_service": client.favorite_service,
                })

        # Sort by most overdue first
        candidates.sort(key=lambda c: (c["days_since"] or 0), reverse=True)
        return candidates[:limit]
    finally:
        if _close_db:
            db.close()
