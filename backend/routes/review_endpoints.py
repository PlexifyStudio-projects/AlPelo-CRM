"""Google Reviews pipeline — review request management and public rating endpoints."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import (
    Tenant, Client, Appointment, Service, ReviewRequest, Notification,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


# ============================================================================
# UTILITY — Create review request (called from workflow engine)
# ============================================================================

def create_review_request(db: Session, client_id: int, appointment_id: int, tenant_id: int) -> ReviewRequest:
    """Create a review request with a unique token. Called from workflow engine after visit."""
    token = uuid.uuid4().hex
    review = ReviewRequest(
        tenant_id=tenant_id,
        client_id=client_id,
        appointment_id=appointment_id,
        status="sent",
        token=token,
        sent_at=datetime.utcnow(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


# ============================================================================
# SETTINGS — Google Review URL
# ============================================================================

@router.put("/settings/google-review-url")
def save_google_review_url(data: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Save the tenant's Google Reviews URL."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    url = (data.get("url") or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="La URL es obligatoria")

    tenant.google_review_url = url
    db.commit()

    return {"success": True, "google_review_url": url, "message": "URL de Google Reviews guardada"}


# ============================================================================
# STATS — Review funnel metrics
# ============================================================================

@router.get("/reviews/stats")
def get_review_stats(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Review stats: sent, clicked, positive, negative, completed counts."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    base = db.query(ReviewRequest).filter(ReviewRequest.tenant_id == tid)

    total_sent = base.count()
    clicked = base.filter(ReviewRequest.status.in_(["clicked", "rated_positive", "rated_negative", "completed"])).count()
    positive = base.filter(ReviewRequest.status.in_(["rated_positive", "completed"])).count()
    negative = base.filter(ReviewRequest.status == "rated_negative").count()
    completed = base.filter(ReviewRequest.status == "completed").count()

    # Average rating (only those who rated)
    avg_rating = base.filter(ReviewRequest.rating.isnot(None)).with_entities(
        func.avg(ReviewRequest.rating)
    ).scalar()

    return {
        "total_sent": total_sent,
        "clicked": clicked,
        "positive": positive,
        "negative": negative,
        "completed": completed,
        "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
    }


# ============================================================================
# LIST — Review requests with status
# ============================================================================

@router.get("/reviews/requests")
def list_review_requests(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """List review requests with client info. Supports pagination."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="No tenant asociado")

    total = db.query(ReviewRequest).filter(ReviewRequest.tenant_id == tid).count()

    requests = (
        db.query(ReviewRequest)
        .filter(ReviewRequest.tenant_id == tid)
        .order_by(ReviewRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for r in requests:
        client = db.query(Client).filter(Client.id == r.client_id).first()
        results.append({
            "id": r.id,
            "client_id": r.client_id,
            "client_name": client.name if client else "Desconocido",
            "client_phone": client.phone if client else None,
            "appointment_id": r.appointment_id,
            "status": r.status,
            "rating": r.rating,
            "feedback_text": r.feedback_text,
            "token": r.token,
            "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            "responded_at": r.responded_at.isoformat() if r.responded_at else None,
        })

    return {"requests": results, "total": total}


# ============================================================================
# PUBLIC — Landing page data (NO AUTH)
# ============================================================================

@router.get("/reviews/landing/{token}")
def get_review_landing(token: str, db: Session = Depends(get_db)):
    """PUBLIC endpoint. Returns data for the rating page using the unique token."""
    review = db.query(ReviewRequest).filter(ReviewRequest.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Solicitud de reseña no encontrada o expirada")

    if review.status in ("rated_positive", "rated_negative", "completed"):
        raise HTTPException(status_code=400, detail="Esta reseña ya fue respondida")

    if review.status == "expired":
        raise HTTPException(status_code=400, detail="Esta solicitud de reseña ha expirado")

    # Mark as clicked if still in "sent" status
    if review.status == "sent":
        review.status = "clicked"
        db.commit()

    # Fetch related data
    tenant = db.query(Tenant).filter(Tenant.id == review.tenant_id).first()
    client = db.query(Client).filter(Client.id == review.client_id).first()

    service_name = None
    if review.appointment_id:
        appointment = db.query(Appointment).filter(Appointment.id == review.appointment_id).first()
        if appointment:
            service = db.query(Service).filter(Service.id == appointment.service_id).first()
            if service:
                service_name = service.name

    return {
        "business_name": tenant.name if tenant else "Negocio",
        "client_first_name": client.name.split()[0] if client and client.name else "Cliente",
        "service_name": service_name,
    }


# ============================================================================
# PUBLIC — Submit rating (NO AUTH)
# ============================================================================

@router.post("/reviews/rate/{token}")
def submit_rating(token: str, data: dict, db: Session = Depends(get_db)):
    """PUBLIC endpoint. Submit a rating for a review request."""
    review = db.query(ReviewRequest).filter(ReviewRequest.token == token).first()
    if not review:
        raise HTTPException(status_code=404, detail="Solicitud de reseña no encontrada o expirada")

    if review.status in ("rated_positive", "rated_negative", "completed"):
        raise HTTPException(status_code=400, detail="Esta reseña ya fue respondida")

    rating = data.get("rating")
    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="El rating debe ser un numero entre 1 y 5")

    feedback_text = (data.get("feedback_text") or "").strip() or None

    review.rating = rating
    review.feedback_text = feedback_text
    review.responded_at = datetime.utcnow()

    google_review_url = None

    if rating >= 4:
        # Positive — redirect to Google Reviews
        review.status = "rated_positive"
        tenant = db.query(Tenant).filter(Tenant.id == review.tenant_id).first()
        if tenant:
            google_review_url = getattr(tenant, "google_review_url", None)
    else:
        # Negative — save feedback internally, notify admin
        review.status = "rated_negative"
        client = db.query(Client).filter(Client.id == review.client_id).first()
        client_name = client.name if client else "Cliente desconocido"

        notification = Notification(
            tenant_id=review.tenant_id,
            type="review_negative",
            title=f"Reseña negativa ({rating}/5) de {client_name}",
            detail=feedback_text or "Sin comentario adicional",
            icon="⚠️",
            link="/reviews",
        )
        db.add(notification)

    db.commit()

    return {
        "success": True,
        "status": review.status,
        "google_review_url": google_review_url,
        "message": "Gracias por tu opinion" if rating <= 3 else "Gracias! Te redirigimos a Google Reviews",
    }
