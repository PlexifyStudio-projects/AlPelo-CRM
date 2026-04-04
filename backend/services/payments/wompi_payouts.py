"""
Wompi Payouts — Staff Disbursement Service.

Uses Wompi's Third-Party Payments API to send real money to staff
bank accounts, Nequi, or Daviplata.

Docs: https://docs.wompi.co/en/docs/colombia/introduccion-pagos-a-terceros/
"""
import httpx
import hashlib
import hmac
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from database.models import Tenant, Staff

WOMPI_PROD_URL = "https://api.payouts.wompi.co/v1"
WOMPI_SANDBOX_URL = "https://api.sandbox.payouts.wompi.co/v1"

# Wompi bank code mapping (most common Colombian banks)
BANK_CODES = {
    "Bancolombia": "BANCOLOMBIA",
    "Davivienda": "DAVIVIENDA",
    "BBVA Colombia": "BBVA",
    "Banco de Bogota": "BANCO_DE_BOGOTA",
    "Banco de Occidente": "BANCO_DE_OCCIDENTE",
    "Scotiabank Colpatria": "SCOTIABANK_COLPATRIA",
    "Banco Popular": "BANCO_POPULAR",
    "AV Villas": "AV_VILLAS",
    "Banco Agrario": "BANCO_AGRARIO",
    "Banco Caja Social": "BANCO_CAJA_SOCIAL",
    "Banco Falabella": "BANCO_FALABELLA",
    "Banco GNB Sudameris": "BANCO_GNB_SUDAMERIS",
    "Banco Pichincha": "BANCO_PICHINCHA",
    "Banco Itau": "BANCO_ITAU",
    "Banco W": "BANCO_W",
    "Bancoomeva": "BANCOOMEVA",
    "Banco Serfinanza": "BANCO_SERFINANZA",
    "Lulo Bank": "LULO_BANK",
}

# Nequi/Daviplata use special Wompi handling (phone-based)
WALLET_METHODS = {"nequi", "daviplata"}


def _get_wompi_config(db: Session, tenant_id: int) -> dict:
    """Get Wompi payout credentials from tenant. Returns config dict or None."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return None

    api_key = getattr(tenant, 'wompi_private_key', None)
    principal_id = getattr(tenant, 'wompi_public_key', None)  # Reusing field for principal ID
    events_key = getattr(tenant, 'wompi_events_key', None)
    env = getattr(tenant, 'wompi_environment', 'sandbox') or 'sandbox'
    enabled = getattr(tenant, 'payments_enabled', False)

    if not api_key or not principal_id:
        return None

    return {
        "api_key": api_key,
        "principal_id": principal_id,
        "events_key": events_key,
        "base_url": WOMPI_PROD_URL if env == "production" else WOMPI_SANDBOX_URL,
        "environment": env,
        "enabled": enabled,
    }


def _wompi_headers(config: dict) -> dict:
    return {
        "Content-Type": "application/json",
        "user-principal-id": config["principal_id"],
        "x-api-key": config["api_key"],
    }


async def get_wompi_banks(db: Session, tenant_id: int) -> list:
    """Fetch available banks from Wompi API."""
    config = _get_wompi_config(db, tenant_id)
    if not config:
        return []

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{config['base_url']}/banks",
            headers=_wompi_headers(config),
        )
        if resp.status_code == 200:
            return resp.json().get("data", [])
    return []


async def get_wompi_accounts(db: Session, tenant_id: int) -> list:
    """Fetch origin accounts (business accounts) from Wompi."""
    config = _get_wompi_config(db, tenant_id)
    if not config:
        return []

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{config['base_url']}/accounts",
            headers=_wompi_headers(config),
        )
        if resp.status_code == 200:
            return resp.json().get("data", [])
    return []


async def create_disbursement(
    db: Session,
    tenant_id: int,
    staff: "Staff",
    amount: int,
    reference: str,
    concept: str = "Pago de nomina",
    account_id: str = None,
) -> dict:
    """
    Create a real disbursement via Wompi Payouts API.

    Args:
        db: Database session
        tenant_id: Tenant ID
        staff: Staff model with bank info
        amount: Amount in COP (whole number, NOT cents — we convert)
        reference: Unique reference (e.g. 'CP-0001-staff5')
        concept: Payment description
        account_id: Origin account UUID from Wompi (if None, uses first available)

    Returns:
        dict with payout_id, status, or error
    """
    config = _get_wompi_config(db, tenant_id)
    if not config:
        return {"ok": False, "error": "Wompi no configurado. Configure las credenciales en Ajustes."}

    if not config["enabled"]:
        return {"ok": False, "error": "Dispersiones desactivadas. Active en Ajustes > Bold / Pagos."}

    # Determine payment method and destination
    method = getattr(staff, 'preferred_payment_method', 'efectivo')

    if method == 'efectivo':
        return {"ok": False, "error": f"{staff.name} tiene metodo de pago 'efectivo'. No se puede dispersar electronicamente."}

    # Build transaction based on payment method
    txn = {
        "amount": amount * 100,  # Wompi uses cents
        "reference": reference,
        "name": staff.name,
        "email": staff.email or f"staff-{staff.id}@plexify.co",
        "legalIdType": getattr(staff, 'document_type', 'CC') or 'CC',
        "legalId": getattr(staff, 'document_number', '') or '',
        "paymentType": "PAYROLL",
    }

    if method in WALLET_METHODS:
        # Nequi or Daviplata — phone-based
        phone = getattr(staff, 'nequi_phone', '') if method == 'nequi' else getattr(staff, 'daviplata_phone', '')
        if not phone:
            return {"ok": False, "error": f"{staff.name} no tiene numero de {method} configurado."}
        # For wallets, Wompi uses bank transfer to Bancolombia (Nequi's bank)
        # with the phone as account number
        import re
        clean_phone = re.sub(r'\D', '', phone)
        txn["accountNumber"] = clean_phone
        txn["accountType"] = "AHORROS"
        txn["bankId"] = None  # Will be resolved from /banks
    elif method == 'transferencia':
        # Traditional bank transfer
        bank_name = getattr(staff, 'bank_name', '')
        account_num = getattr(staff, 'bank_account_number', '')
        account_type = getattr(staff, 'bank_account_type', 'Ahorros')

        if not bank_name or not account_num:
            return {"ok": False, "error": f"{staff.name} no tiene cuenta bancaria configurada."}

        txn["accountNumber"] = account_num
        txn["accountType"] = "AHORROS" if account_type == "Ahorros" else "CORRIENTE"
        txn["bankId"] = None  # Will be resolved
    else:
        return {"ok": False, "error": f"Metodo de pago '{method}' no soportado para dispersiones."}

    if not txn.get("legalId"):
        return {"ok": False, "error": f"{staff.name} no tiene numero de documento configurado. Actualice en Equipo."}

    # Resolve bank ID from Wompi's bank list
    try:
        banks = await get_wompi_banks(db, tenant_id)
        if not banks:
            return {"ok": False, "error": "No se pudieron obtener los bancos de Wompi. Verifique las credenciales."}

        if method == 'nequi':
            bank_match = next((b for b in banks if 'NEQUI' in (b.get('name', '') or '').upper()), None)
            if not bank_match:
                # Nequi uses Bancolombia's infrastructure
                bank_match = next((b for b in banks if 'BANCOLOMBIA' in (b.get('name', '') or '').upper()), None)
        elif method == 'daviplata':
            bank_match = next((b for b in banks if 'DAVIPLATA' in (b.get('name', '') or '').upper() or 'DAVIVIENDA' in (b.get('name', '') or '').upper()), None)
        else:
            staff_bank = getattr(staff, 'bank_name', '')
            # Try exact match first, then partial
            bank_match = next((b for b in banks if (b.get('name', '') or '').upper() == staff_bank.upper()), None)
            if not bank_match:
                bank_match = next((b for b in banks if staff_bank.upper() in (b.get('name', '') or '').upper()), None)

        if not bank_match:
            return {"ok": False, "error": f"Banco '{getattr(staff, 'bank_name', method)}' no encontrado en Wompi. Verifique la configuracion."}

        txn["bankId"] = bank_match["id"]
    except Exception as e:
        return {"ok": False, "error": f"Error consultando bancos: {str(e)}"}

    # Get origin account
    if not account_id:
        try:
            accounts = await get_wompi_accounts(db, tenant_id)
            if not accounts:
                return {"ok": False, "error": "No hay cuentas de origen en Wompi. Configure una cuenta en bold.co."}
            account_id = accounts[0]["id"]
        except Exception as e:
            return {"ok": False, "error": f"Error consultando cuentas: {str(e)}"}

    txn["accountId"] = account_id

    # Create the payout
    payload = {"transactions": [txn]}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{config['base_url']}/payouts",
                headers=_wompi_headers(config),
                json=payload,
            )

            if resp.status_code in (200, 201):
                data = resp.json()
                payout_id = data.get("data", {}).get("id") or data.get("id")
                return {
                    "ok": True,
                    "payout_id": payout_id,
                    "status": "PROCESSING",
                    "environment": config["environment"],
                    "message": f"Dispersion creada ({config['environment']}). ID: {payout_id}",
                }
            else:
                error_data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
                error_msg = error_data.get("message") or error_data.get("error") or resp.text[:200]
                return {"ok": False, "error": f"Wompi respondio {resp.status_code}: {error_msg}"}
    except httpx.TimeoutException:
        return {"ok": False, "error": "Timeout al conectar con Wompi. Intente de nuevo."}
    except Exception as e:
        return {"ok": False, "error": f"Error de conexion: {str(e)}"}


async def check_payout_status(db: Session, tenant_id: int, payout_id: str) -> dict:
    """Check status of a payout batch."""
    config = _get_wompi_config(db, tenant_id)
    if not config:
        return {"ok": False, "error": "Wompi no configurado"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{config['base_url']}/payouts/{payout_id}/transactions",
                headers=_wompi_headers(config),
            )
            if resp.status_code == 200:
                data = resp.json()
                return {"ok": True, "transactions": data.get("data", [])}
            return {"ok": False, "error": f"Status {resp.status_code}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def verify_webhook_signature(payload: bytes, signature: str, events_key: str) -> bool:
    """Verify Wompi webhook signature (SHA256 HMAC)."""
    expected = hmac.new(events_key.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
