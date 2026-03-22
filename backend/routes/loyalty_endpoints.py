# ============================================================================
# Plexify Studio — Loyalty Program Endpoints
# Points system, tiers, referrals, leaderboard
# ============================================================================

from typing import Optional
from datetime import datetime, timedelta
from math import floor

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from database.connection import get_db
from database.models import (
    LoyaltyConfig, LoyaltyAccount, LoyaltyTransaction, Client,
)
from middleware.auth_middleware import get_current_user
from routes._helpers import safe_tid

router = APIRouter()


# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class LoyaltyConfigUpdate(BaseModel):
    points_per_currency: Optional[float] = None
    currency_unit: Optional[int] = None
    tier_bronze_min: Optional[int] = None
    tier_silver_min: Optional[int] = None
    tier_gold_min: Optional[int] = None
    tier_vip_min: Optional[int] = None
    referral_bonus_referrer: Optional[int] = None
    referral_bonus_referred: Optional[int] = None
    birthday_bonus: Optional[int] = None
    redemption_rate: Optional[float] = None
    is_active: Optional[bool] = None


class EarnRedeemRequest(BaseModel):
    client_id: int
    points: int
    description: Optional[str] = None


class ReferralRequest(BaseModel):
    referrer_client_id: int
    referred_client_id: int


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def calculate_tier(total_points: int, config: LoyaltyConfig) -> str:
    """Determine tier based on total accumulated points."""
    if total_points >= config.tier_vip_min:
        return "vip"
    if total_points >= config.tier_gold_min:
        return "gold"
    if total_points >= config.tier_silver_min:
        return "silver"
    return "bronze"


def _get_or_create_config(db: Session, tenant_id: int) -> LoyaltyConfig:
    """Get loyalty config for tenant, creating default if it doesn't exist."""
    config = db.query(LoyaltyConfig).filter(
        LoyaltyConfig.tenant_id == tenant_id
    ).first()
    if not config:
        config = LoyaltyConfig(tenant_id=tenant_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _get_or_create_account(db: Session, client_id: int, tenant_id: int) -> LoyaltyAccount:
    """Get loyalty account for client, creating if it doesn't exist."""
    account = db.query(LoyaltyAccount).filter(
        LoyaltyAccount.client_id == client_id,
        LoyaltyAccount.tenant_id == tenant_id,
    ).first()
    if not account:
        account = LoyaltyAccount(
            tenant_id=tenant_id,
            client_id=client_id,
            total_points=0,
            available_points=0,
            tier="bronze",
        )
        db.add(account)
        db.commit()
        db.refresh(account)
    return account


def award_visit_points(db: Session, client_id: int, amount: float, tenant_id: int, visit_id: int = None):
    """Award loyalty points for a completed visit. Called from visit creation hooks.

    Calculates points as: (amount / currency_unit) * points_per_currency
    Updates account totals, recalculates tier, and logs the transaction.
    """
    config = _get_or_create_config(db, tenant_id)
    if not config.is_active:
        return None

    # Calculate points earned
    if config.currency_unit <= 0:
        return None
    points = floor((amount / config.currency_unit) * config.points_per_currency)
    if points <= 0:
        return None

    # Get or create account
    account = _get_or_create_account(db, client_id, tenant_id)

    # Update balances
    account.total_points += points
    account.available_points += points
    account.tier = calculate_tier(account.total_points, config)
    account.updated_at = datetime.utcnow()

    # Log transaction
    txn = LoyaltyTransaction(
        tenant_id=tenant_id,
        client_id=client_id,
        type="earn_visit",
        points=points,
        description=f"Puntos por visita — ${int(amount):,} COP",
        visit_id=visit_id,
    )
    db.add(txn)
    db.commit()
    db.refresh(account)
    return account


# ============================================================================
# 1. GET /loyalty/config — Get tenant config (auto-create default)
# ============================================================================

@router.get("/loyalty/config")
def get_loyalty_config(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    config = _get_or_create_config(db, tid)
    return {
        "id": config.id,
        "tenant_id": config.tenant_id,
        "points_per_currency": config.points_per_currency,
        "currency_unit": config.currency_unit,
        "tier_bronze_min": config.tier_bronze_min,
        "tier_silver_min": config.tier_silver_min,
        "tier_gold_min": config.tier_gold_min,
        "tier_vip_min": config.tier_vip_min,
        "referral_bonus_referrer": config.referral_bonus_referrer,
        "referral_bonus_referred": config.referral_bonus_referred,
        "birthday_bonus": config.birthday_bonus,
        "redemption_rate": config.redemption_rate,
        "is_active": config.is_active,
    }


# ============================================================================
# 2. PUT /loyalty/config — Update loyalty config
# ============================================================================

@router.put("/loyalty/config")
def update_loyalty_config(
    payload: LoyaltyConfigUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    config = _get_or_create_config(db, tid)

    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)
    config.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(config)
    return {"ok": True, "message": "Configuración de lealtad actualizada"}


# ============================================================================
# 3. GET /loyalty/client/{client_id} — Account + last 20 transactions
# ============================================================================

@router.get("/loyalty/client/{client_id}")
def get_client_loyalty(
    client_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    # Verify client belongs to tenant
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.tenant_id == tid,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    account = _get_or_create_account(db, client_id, tid)
    config = _get_or_create_config(db, tid)

    # Recalculate tier in case config thresholds changed
    new_tier = calculate_tier(account.total_points, config)
    if new_tier != account.tier:
        account.tier = new_tier
        db.commit()
        db.refresh(account)

    # Last 20 transactions
    transactions = (
        db.query(LoyaltyTransaction)
        .filter(
            LoyaltyTransaction.client_id == client_id,
            LoyaltyTransaction.tenant_id == tid,
        )
        .order_by(LoyaltyTransaction.created_at.desc())
        .limit(20)
        .all()
    )

    return {
        "account": {
            "id": account.id,
            "client_id": account.client_id,
            "total_points": account.total_points,
            "available_points": account.available_points,
            "tier": account.tier,
            "referred_by_client_id": account.referred_by_client_id,
            "birthday_bonus_year": account.birthday_bonus_year,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        },
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "points": t.points,
                "description": t.description,
                "visit_id": t.visit_id,
                "created_at": t.created_at,
            }
            for t in transactions
        ],
        "config": {
            "redemption_rate": config.redemption_rate,
            "currency_unit": config.currency_unit,
            "is_active": config.is_active,
        },
    }


# ============================================================================
# 4. POST /loyalty/earn — Award points manually
# ============================================================================

@router.post("/loyalty/earn")
def earn_points(
    payload: EarnRedeemRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    if payload.points <= 0:
        raise HTTPException(status_code=400, detail="Los puntos deben ser positivos")

    # Verify client belongs to tenant
    client = db.query(Client).filter(
        Client.id == payload.client_id,
        Client.tenant_id == tid,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    config = _get_or_create_config(db, tid)
    if not config.is_active:
        raise HTTPException(status_code=400, detail="Programa de lealtad desactivado")

    account = _get_or_create_account(db, payload.client_id, tid)

    account.total_points += payload.points
    account.available_points += payload.points
    account.tier = calculate_tier(account.total_points, config)
    account.updated_at = datetime.utcnow()

    txn = LoyaltyTransaction(
        tenant_id=tid,
        client_id=payload.client_id,
        type="admin_adjust",
        points=payload.points,
        description=payload.description or "Puntos otorgados manualmente",
    )
    db.add(txn)
    db.commit()
    db.refresh(account)

    return {
        "ok": True,
        "total_points": account.total_points,
        "available_points": account.available_points,
        "tier": account.tier,
    }


# ============================================================================
# 5. POST /loyalty/redeem — Redeem points
# ============================================================================

@router.post("/loyalty/redeem")
def redeem_points(
    payload: EarnRedeemRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    if payload.points <= 0:
        raise HTTPException(status_code=400, detail="Los puntos deben ser positivos")

    # Verify client belongs to tenant
    client = db.query(Client).filter(
        Client.id == payload.client_id,
        Client.tenant_id == tid,
    ).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    config = _get_or_create_config(db, tid)
    if not config.is_active:
        raise HTTPException(status_code=400, detail="Programa de lealtad desactivado")

    account = _get_or_create_account(db, payload.client_id, tid)

    if account.available_points < payload.points:
        raise HTTPException(
            status_code=400,
            detail=f"Puntos insuficientes. Disponibles: {account.available_points}",
        )

    account.available_points -= payload.points
    account.updated_at = datetime.utcnow()

    txn = LoyaltyTransaction(
        tenant_id=tid,
        client_id=payload.client_id,
        type="redeem",
        points=-payload.points,
        description=payload.description or "Canje de puntos",
    )
    db.add(txn)
    db.commit()
    db.refresh(account)

    return {
        "ok": True,
        "total_points": account.total_points,
        "available_points": account.available_points,
        "tier": account.tier,
    }


# ============================================================================
# 6. POST /loyalty/referral — Process referral bonus
# ============================================================================

@router.post("/loyalty/referral")
def process_referral(
    payload: ReferralRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    if payload.referrer_client_id == payload.referred_client_id:
        raise HTTPException(status_code=400, detail="Un cliente no puede referirse a sí mismo")

    # Verify both clients belong to tenant
    referrer = db.query(Client).filter(
        Client.id == payload.referrer_client_id,
        Client.tenant_id == tid,
    ).first()
    if not referrer:
        raise HTTPException(status_code=404, detail="Cliente referidor no encontrado")

    referred = db.query(Client).filter(
        Client.id == payload.referred_client_id,
        Client.tenant_id == tid,
    ).first()
    if not referred:
        raise HTTPException(status_code=404, detail="Cliente referido no encontrado")

    config = _get_or_create_config(db, tid)
    if not config.is_active:
        raise HTTPException(status_code=400, detail="Programa de lealtad desactivado")

    # Check if referred client already has a referrer
    referred_account = _get_or_create_account(db, payload.referred_client_id, tid)
    if referred_account.referred_by_client_id:
        raise HTTPException(status_code=400, detail="Este cliente ya fue referido por otro cliente")

    # Mark referred_by
    referred_account.referred_by_client_id = payload.referrer_client_id

    # Award bonus to referrer
    referrer_account = _get_or_create_account(db, payload.referrer_client_id, tid)
    referrer_bonus = config.referral_bonus_referrer

    referrer_account.total_points += referrer_bonus
    referrer_account.available_points += referrer_bonus
    referrer_account.tier = calculate_tier(referrer_account.total_points, config)
    referrer_account.updated_at = datetime.utcnow()

    txn_referrer = LoyaltyTransaction(
        tenant_id=tid,
        client_id=payload.referrer_client_id,
        type="earn_referral",
        points=referrer_bonus,
        description=f"Bono por referir a {referred.name}",
    )
    db.add(txn_referrer)

    # Award bonus to referred
    referred_bonus = config.referral_bonus_referred
    referred_account.total_points += referred_bonus
    referred_account.available_points += referred_bonus
    referred_account.tier = calculate_tier(referred_account.total_points, config)
    referred_account.updated_at = datetime.utcnow()

    txn_referred = LoyaltyTransaction(
        tenant_id=tid,
        client_id=payload.referred_client_id,
        type="earn_referral",
        points=referred_bonus,
        description=f"Bono de bienvenida — referido por {referrer.name}",
    )
    db.add(txn_referred)

    db.commit()
    return {
        "ok": True,
        "referrer": {
            "client_id": payload.referrer_client_id,
            "points_awarded": referrer_bonus,
            "total_points": referrer_account.total_points,
        },
        "referred": {
            "client_id": payload.referred_client_id,
            "points_awarded": referred_bonus,
            "total_points": referred_account.total_points,
        },
    }


# ============================================================================
# 7. GET /loyalty/leaderboard — Top 10 by total_points
# ============================================================================

@router.get("/loyalty/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    accounts = (
        db.query(LoyaltyAccount, Client.name, Client.phone)
        .join(Client, Client.id == LoyaltyAccount.client_id)
        .filter(
            LoyaltyAccount.tenant_id == tid,
            Client.tenant_id == tid,
        )
        .order_by(LoyaltyAccount.total_points.desc())
        .limit(10)
        .all()
    )

    return [
        {
            "rank": idx + 1,
            "client_id": acct.client_id,
            "client_name": name,
            "client_phone": phone,
            "total_points": acct.total_points,
            "available_points": acct.available_points,
            "tier": acct.tier,
        }
        for idx, (acct, name, phone) in enumerate(accounts)
    ]


# ============================================================================
# 8. GET /loyalty/stats — Summary statistics
# ============================================================================

@router.get("/loyalty/stats")
def get_loyalty_stats(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tid = safe_tid(current_user, db)
    if not tid:
        raise HTTPException(status_code=400, detail="Tenant not identified")

    # Total members
    total_members = db.query(func.count(LoyaltyAccount.id)).filter(
        LoyaltyAccount.tenant_id == tid,
    ).scalar() or 0

    # Members per tier
    tier_counts = (
        db.query(LoyaltyAccount.tier, func.count(LoyaltyAccount.id))
        .filter(LoyaltyAccount.tenant_id == tid)
        .group_by(LoyaltyAccount.tier)
        .all()
    )
    tiers = {tier: count for tier, count in tier_counts}

    # Total points issued this month
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    points_this_month = (
        db.query(func.coalesce(func.sum(LoyaltyTransaction.points), 0))
        .filter(
            LoyaltyTransaction.tenant_id == tid,
            LoyaltyTransaction.points > 0,
            LoyaltyTransaction.created_at >= first_of_month,
        )
        .scalar()
    ) or 0

    # Total points redeemed this month
    points_redeemed_month = (
        db.query(func.coalesce(func.sum(func.abs(LoyaltyTransaction.points)), 0))
        .filter(
            LoyaltyTransaction.tenant_id == tid,
            LoyaltyTransaction.points < 0,
            LoyaltyTransaction.created_at >= first_of_month,
        )
        .scalar()
    ) or 0

    return {
        "total_members": total_members,
        "tiers": {
            "bronze": tiers.get("bronze", 0),
            "silver": tiers.get("silver", 0),
            "gold": tiers.get("gold", 0),
            "vip": tiers.get("vip", 0),
        },
        "points_issued_this_month": points_this_month,
        "points_redeemed_this_month": points_redeemed_month,
    }
