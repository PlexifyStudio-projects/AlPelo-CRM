"""
Plexify Studio — No-Show Prediction Engine
Calculates risk score (0-100) per appointment based on client history,
day-of-week, time-of-day, confirmation status, and visit patterns.
"""

from datetime import datetime, timedelta
from sqlalchemy.orm import Session


def calculate_no_show_risk(appointment, db: Session, tenant_id: int = None) -> dict:
    """Calculate no-show risk score for an appointment.
    Returns: { risk_score: 0-100, risk_level: low/medium/high/critical, factors: [...] }
    """
    from database.models import Appointment, VisitHistory, Client

    score = 0
    factors = []

    # ── 1. Client history ──
    client = None
    if appointment.client_id:
        client = db.query(Client).filter(Client.id == appointment.client_id).first()

    if client:
        # No-show history
        no_shows = db.query(VisitHistory).filter(
            VisitHistory.client_id == client.id,
            VisitHistory.status == 'no_show',
        ).count()

        if no_shows >= 3:
            score += 35
            factors.append(f"{no_shows} inasistencias previas")
        elif no_shows >= 1:
            score += 20 * no_shows
            factors.append(f"{no_shows} inasistencia(s) previa(s)")

        # Total visits — new clients are riskier
        total_visits = db.query(VisitHistory).filter(
            VisitHistory.client_id == client.id,
            VisitHistory.status != 'no_show',
        ).count()

        if total_visits == 0:
            score += 15
            factors.append("Primera visita (sin historial)")
        elif total_visits >= 10:
            score -= 15  # VIP/loyal clients are reliable
            factors.append(f"Cliente fiel ({total_visits} visitas)")

        # Recent cancellations (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_cancels = db.query(Appointment).filter(
            Appointment.client_id == client.id,
            Appointment.status == 'cancelled',
            Appointment.created_at >= thirty_days_ago,
        ).count()
        if recent_cancels >= 2:
            score += 15
            factors.append(f"{recent_cancels} cancelaciones recientes")
    else:
        score += 10
        factors.append("Cliente no registrado en CRM")

    # ── 2. Day of week ──
    try:
        apt_date = appointment.date
        if isinstance(apt_date, str):
            apt_date = datetime.strptime(apt_date, '%Y-%m-%d').date()
        weekday = apt_date.weekday()  # 0=Monday

        if weekday == 0:  # Monday
            score += 8
            factors.append("Lunes (mayor ausentismo)")
        elif weekday == 4:  # Friday
            score += 5
            factors.append("Viernes (riesgo moderado)")
    except (ValueError, AttributeError):
        pass

    # ── 3. Time of day ──
    try:
        time_str = appointment.time
        hour = int(time_str.split(":")[0])

        if hour <= 8:
            score += 10
            factors.append("Primera hora del dia")
        elif hour >= 19:
            score += 8
            factors.append("Ultima hora del dia")
    except (ValueError, AttributeError, IndexError):
        pass

    # ── 4. How far in advance was it booked? ──
    try:
        if appointment.created_at and appointment.date:
            apt_date = appointment.date
            if isinstance(apt_date, str):
                apt_date = datetime.strptime(apt_date, '%Y-%m-%d').date()
            days_ahead = (apt_date - appointment.created_at.date()).days
            if days_ahead > 7:
                score += 10
                factors.append(f"Agendada {days_ahead} dias antes")
    except (ValueError, AttributeError):
        pass

    # Clamp score
    score = max(0, min(100, score))

    # Risk level
    if score >= 70:
        level = "critical"
    elif score >= 45:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    return {
        "risk_score": score,
        "risk_level": level,
        "factors": factors,
    }


def get_appointments_with_risk(db: Session, date_filter, tenant_id: int = None) -> list:
    """Get all appointments for a date with their no-show risk scores."""
    from database.models import Appointment

    q = db.query(Appointment).filter(
        Appointment.date == date_filter,
        Appointment.status == "confirmed",
    )
    if tenant_id:
        q = q.filter(Appointment.tenant_id == tenant_id)

    appointments = q.order_by(Appointment.time).all()
    results = []
    for apt in appointments:
        risk = calculate_no_show_risk(apt, db, tenant_id)
        results.append({
            "appointment_id": apt.id,
            "client_name": apt.client_name,
            "time": apt.time,
            "staff_id": apt.staff_id,
            "service_name": apt.service_name,
            **risk,
        })
    return results
