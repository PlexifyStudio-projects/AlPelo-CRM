"""
Alegra API integration for Colombian electronic invoicing (DIAN).
Uses Main API: https://api.alegra.com/api/v1
Auth: Basic Auth (email:token)
"""
import httpx
import base64
import logging
from datetime import date

logger = logging.getLogger(__name__)

ALEGRA_BASE = "https://api.alegra.com/api/v1"
ALEGRA_SANDBOX = "https://sandbox.alegra.com/api/v1"

# DIAN document type codes
DOC_TYPES = {"CC": "CC", "NIT": "NIT", "CE": "CE", "TI": "TI", "Pasaporte": "PASAPORTE", "DIE": "DIE"}

# DIAN payment method mapping
PAYMENT_METHODS_DIAN = {
    "efectivo": {"id": 1},          # Efectivo
    "transferencia": {"id": 2},     # Transferencia bancaria
    "bancolombia": {"id": 2},       # Transferencia
    "tarjeta": {"id": 3},           # Tarjeta
    "tarjeta_debito": {"id": 3},    # Tarjeta debito
    "tarjeta_credito": {"id": 3},   # Tarjeta credito
    "nequi": {"id": 2},             # Nequi = transferencia
    "daviplata": {"id": 2},         # Daviplata = transferencia
}


class AlegraService:
    """Service to interact with Alegra API for DIAN electronic invoicing."""

    def __init__(self, email: str, token: str, environment: str = "production"):
        self.email = email
        self.token = token
        self.base_url = ALEGRA_SANDBOX if environment == "test" else ALEGRA_BASE
        credentials = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, json=None, params=None):
        """Make authenticated request to Alegra API."""
        url = f"{self.base_url}{path}"
        try:
            with httpx.Client(timeout=30) as client:
                resp = client.request(method, url, headers=self.headers, json=json, params=params)
                if resp.status_code >= 400:
                    logger.error(f"Alegra API error {resp.status_code}: {resp.text[:500]}")
                    return {"error": True, "status": resp.status_code, "detail": resp.text[:500]}
                return resp.json()
        except httpx.TimeoutException:
            logger.error(f"Alegra API timeout: {method} {path}")
            return {"error": True, "status": 408, "detail": "Timeout conectando con Alegra"}
        except Exception as e:
            logger.error(f"Alegra API exception: {e}")
            return {"error": True, "status": 500, "detail": str(e)}

    def test_connection(self):
        """Test API connection by fetching company info."""
        result = self._request("GET", "/company")
        if isinstance(result, dict) and result.get("error"):
            return False, result.get("detail", "Error de conexion")
        return True, result.get("name", "Conectado")

    def find_or_create_contact(self, name: str, doc_type: str = "CC", doc_number: str = None,
                                email: str = None, phone: str = None, address: str = None):
        """Find existing contact or create new one in Alegra."""
        # Search by identification
        if doc_number:
            search = self._request("GET", "/contacts", params={"identification": doc_number})
            if isinstance(search, list) and len(search) > 0:
                return search[0]

        # Search by name
        search = self._request("GET", "/contacts", params={"name": name})
        if isinstance(search, list) and len(search) > 0:
            return search[0]

        # Create new contact
        contact_data = {
            "name": name,
            "type": ["client"],
        }
        if doc_number:
            contact_data["identification"] = {
                "type": DOC_TYPES.get(doc_type, "CC"),
                "number": doc_number,
            }
        if email:
            contact_data["email"] = email
        if phone:
            contact_data["phonePrimary"] = phone
        if address:
            contact_data["address"] = {"address": address}

        result = self._request("POST", "/contacts", json=contact_data)
        if isinstance(result, dict) and result.get("error"):
            logger.error(f"Failed to create Alegra contact: {result}")
            return None
        return result

    def create_and_stamp_invoice(self, invoice_data: dict, number_template_id: str = None):
        """
        Create invoice in Alegra and stamp it (send to DIAN).

        invoice_data should contain:
        - client_name, client_document_type, client_document, client_email, client_phone, client_address
        - items: [{service_name, quantity, unit_price, total}]
        - subtotal, tax_rate, tax_amount, total
        - payment_method, issued_date, payment_terms
        - notes
        """
        # 1. Find or create contact
        contact = self.find_or_create_contact(
            name=invoice_data.get("client_name", "Consumidor Final"),
            doc_type=invoice_data.get("client_document_type", "CC"),
            doc_number=invoice_data.get("client_document"),
            email=invoice_data.get("client_email"),
            phone=invoice_data.get("client_phone"),
            address=invoice_data.get("client_address"),
        )
        if not contact or (isinstance(contact, dict) and contact.get("error")):
            return {"error": True, "detail": "No se pudo crear/encontrar el contacto en Alegra"}

        contact_id = contact.get("id")

        # 2. Build items
        items = []
        for item in invoice_data.get("items", []):
            alegra_item = {
                "description": item.get("service_name", "Servicio"),
                "quantity": item.get("quantity", 1),
                "price": item.get("unit_price", 0),
            }
            # Add IVA tax if applicable
            tax_rate = invoice_data.get("tax_rate", 0)
            if tax_rate > 0:
                alegra_item["tax"] = [{"id": 3}]  # IVA 19% in Alegra (standard ID)
            items.append(alegra_item)

        # 3. Build payment
        payment_method_key = invoice_data.get("payment_method", "efectivo")
        dian_payment = PAYMENT_METHODS_DIAN.get(payment_method_key, {"id": 1})

        # 4. Build invoice payload
        payload = {
            "date": invoice_data.get("issued_date", date.today().isoformat()),
            "dueDate": invoice_data.get("due_date") or invoice_data.get("issued_date", date.today().isoformat()),
            "client": {"id": contact_id},
            "items": items,
            "status": "open",
            "stamp": {"generateStamp": True},  # Auto-send to DIAN
            "payments": [{
                "date": invoice_data.get("issued_date", date.today().isoformat()),
                "account": {"id": 1},  # Default cash account
                "amount": invoice_data.get("total", 0),
                "paymentMethod": dian_payment.get("id", 1),
            }],
        }

        if number_template_id:
            payload["numberTemplate"] = {"id": number_template_id}

        if invoice_data.get("notes"):
            payload["observations"] = invoice_data["notes"][:500]

        # Discount
        discount_amount = invoice_data.get("discount_amount", 0)
        if discount_amount > 0 and items:
            # Apply discount proportionally to first item
            items[0]["discount"] = discount_amount

        logger.info(f"Creating Alegra invoice for {invoice_data.get('client_name')} — total: {invoice_data.get('total')}")

        # 5. Create invoice
        result = self._request("POST", "/invoices", json=payload)
        if isinstance(result, dict) and result.get("error"):
            return result

        alegra_id = str(result.get("id", ""))
        cufe = None
        dian_status = "sent"

        # Check stamp status
        stamp_info = result.get("stamp", {})
        if stamp_info:
            cufe = stamp_info.get("cufe")
            status = stamp_info.get("status", "").lower()
            legal = stamp_info.get("legalStatus", "").lower()
            if legal == "accepted" or status == "stamped":
                dian_status = "accepted"
            elif legal == "rejected":
                dian_status = "rejected"

        # Get PDF URL
        pdf_url = None
        if alegra_id:
            detail = self._request("GET", f"/invoices/{alegra_id}", params={"pdf": "true"})
            if isinstance(detail, dict) and not detail.get("error"):
                pdf_url = detail.get("pdf")

        return {
            "error": False,
            "alegra_id": alegra_id,
            "cufe": cufe,
            "dian_status": dian_status,
            "pdf_url": pdf_url,
            "alegra_number": result.get("numberTemplate", {}).get("fullNumber", ""),
            "raw_response": str(result)[:1000],
        }

    def get_invoice_status(self, alegra_id: str):
        """Check current DIAN status of an invoice."""
        result = self._request("GET", f"/invoices/{alegra_id}")
        if isinstance(result, dict) and result.get("error"):
            return result

        stamp = result.get("stamp", {})
        status = "pending"
        if stamp:
            legal = stamp.get("legalStatus", "").lower()
            if legal == "accepted":
                status = "accepted"
            elif legal == "rejected":
                status = "rejected"
            elif stamp.get("status", "").lower() in ("stamped", "sent"):
                status = "sent"

        return {
            "error": False,
            "dian_status": status,
            "cufe": stamp.get("cufe"),
            "government_response": stamp.get("governmentResponse", {}),
        }

    def stamp_invoices(self, alegra_ids: list):
        """Stamp (send to DIAN) multiple invoices at once. Max 10."""
        if len(alegra_ids) > 10:
            alegra_ids = alegra_ids[:10]
        result = self._request("POST", "/invoices/stamp", json={"ids": alegra_ids})
        return result
