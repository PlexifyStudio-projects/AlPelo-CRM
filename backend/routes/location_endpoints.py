# ============================================================================
# LOCATION ENDPOINTS — CRUD for multi-location (sedes) per tenant
# ============================================================================

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import Location, StaffLocation, Tenant, Staff
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter(prefix="/locations", tags=["Locations"])


@router.get("/")
async def list_locations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """List all locations for the current tenant."""
    tid = safe_tid(user, db)
    if not tid:
        return []
    locations = (
        db.query(Location)
        .filter(Location.tenant_id == tid, Location.is_active == True)
        .order_by(Location.is_default.desc(), Location.name)
        .all()
    )
    return [_serialize(loc, db) for loc in locations]


@router.get("/me")
async def my_locations(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get locations assigned to the current user (for staff)."""
    tid = safe_tid(user, db)
    if not tid:
        return []

    if getattr(user, '_auth_role', '') == 'staff':
        staff_locs = db.query(StaffLocation).filter(StaffLocation.staff_id == user.id).all()
        loc_ids = [sl.location_id for sl in staff_locs]
        if not loc_ids:
            # Staff not assigned to any location — show all
            return await list_locations(db=db, user=user)
        locations = db.query(Location).filter(Location.id.in_(loc_ids), Location.is_active == True).all()
        return [_serialize(loc, db) for loc in locations]

    # Admin/dev sees all
    return await list_locations(db=db, user=user)


@router.post("/")
async def create_location(body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Create a new location for the tenant."""
    tid = safe_tid(user, db)
    if not tid:
        raise HTTPException(400, "No tenant assigned")

    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "El nombre es requerido")

    # Generate slug
    import re
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

    # Check if it's the first location (make it default)
    existing_count = db.query(Location).filter(Location.tenant_id == tid).count()

    loc = Location(
        tenant_id=tid,
        name=name,
        slug=slug,
        address=body.get("address"),
        phone=body.get("phone"),
        opening_time=body.get("opening_time", "08:00"),
        closing_time=body.get("closing_time", "19:00"),
        days_open=body.get("days_open", [0, 1, 2, 3, 4, 5]),
        wa_phone_number_id=body.get("wa_phone_number_id"),
        is_default=existing_count == 0,
        is_active=True,
    )
    db.add(loc)
    db.commit()
    db.refresh(loc)

    return _serialize(loc, db)


@router.get("/{location_id}")
async def get_location(location_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get a single location."""
    tid = safe_tid(user, db)
    loc = db.query(Location).filter(Location.id == location_id, Location.tenant_id == tid).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")
    return _serialize(loc, db)


@router.put("/{location_id}")
async def update_location(location_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Update a location."""
    tid = safe_tid(user, db)
    loc = db.query(Location).filter(Location.id == location_id, Location.tenant_id == tid).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")

    for field in ["name", "address", "phone", "opening_time", "closing_time", "days_open", "wa_phone_number_id"]:
        if field in body:
            setattr(loc, field, body[field])

    loc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(loc)

    return _serialize(loc, db)


@router.delete("/{location_id}")
async def delete_location(location_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Soft-delete a location (deactivate)."""
    tid = safe_tid(user, db)
    loc = db.query(Location).filter(Location.id == location_id, Location.tenant_id == tid).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")
    if loc.is_default:
        raise HTTPException(400, "No se puede eliminar la sede principal")

    loc.is_active = False
    loc.updated_at = datetime.utcnow()
    db.commit()

    return {"ok": True}


@router.post("/{location_id}/assign-staff")
async def assign_staff(location_id: int, body: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Assign staff members to a location."""
    tid = safe_tid(user, db)
    loc = db.query(Location).filter(Location.id == location_id, Location.tenant_id == tid).first()
    if not loc:
        raise HTTPException(404, "Sede no encontrada")

    staff_ids = body.get("staff_ids", [])
    is_primary = body.get("is_primary", False)

    for sid in staff_ids:
        staff = db.query(Staff).filter(Staff.id == sid).first()
        if not staff:
            continue
        # Check if already assigned
        existing = db.query(StaffLocation).filter(
            StaffLocation.staff_id == sid, StaffLocation.location_id == location_id
        ).first()
        if not existing:
            db.add(StaffLocation(staff_id=sid, location_id=location_id, is_primary=is_primary))
        if is_primary:
            staff.primary_location_id = location_id
    db.commit()

    return {"ok": True, "assigned": len(staff_ids)}


@router.get("/{location_id}/staff")
async def location_staff(location_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Get staff assigned to a location."""
    tid = safe_tid(user, db)
    staff_locs = db.query(StaffLocation).filter(StaffLocation.location_id == location_id).all()
    staff_ids = [sl.staff_id for sl in staff_locs]
    staff = db.query(Staff).filter(Staff.id.in_(staff_ids), Staff.is_active == True).all() if staff_ids else []
    return [{"id": s.id, "name": s.name, "role": s.role, "is_primary": any(sl.is_primary for sl in staff_locs if sl.staff_id == s.id)} for s in staff]


def _serialize(loc, db):
    """Serialize a Location for API response."""
    staff_count = db.query(StaffLocation).filter(StaffLocation.location_id == loc.id).count()
    return {
        "id": loc.id,
        "tenant_id": loc.tenant_id,
        "name": loc.name,
        "slug": loc.slug,
        "address": loc.address,
        "phone": loc.phone,
        "opening_time": loc.opening_time,
        "closing_time": loc.closing_time,
        "days_open": loc.days_open,
        "wa_phone_number_id": loc.wa_phone_number_id,
        "is_active": loc.is_active,
        "is_default": loc.is_default,
        "staff_count": staff_count,
        "created_at": loc.created_at.isoformat() if loc.created_at else None,
    }
