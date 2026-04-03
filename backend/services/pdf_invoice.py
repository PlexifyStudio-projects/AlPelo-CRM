"""Generate PDF invoices using fpdf2. Pure Python, no system dependencies."""
import io
from datetime import datetime
from fpdf import FPDF


class InvoicePDF(FPDF):
    """Custom PDF for invoices with tenant branding."""

    def __init__(self, tenant_name="", tenant_nit="", tenant_address="", tenant_phone=""):
        super().__init__()
        self.tenant_name = tenant_name
        self.tenant_nit = tenant_nit
        self.tenant_address = tenant_address
        self.tenant_phone = tenant_phone
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        # Business info
        self.set_font("Helvetica", "B", 16)
        self.cell(0, 8, self.tenant_name, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(100, 100, 100)
        if self.tenant_nit:
            self.cell(0, 4, f"NIT: {self.tenant_nit}", new_x="LMARGIN", new_y="NEXT")
        if self.tenant_address:
            self.cell(0, 4, self.tenant_address, new_x="LMARGIN", new_y="NEXT")
        if self.tenant_phone:
            self.cell(0, 4, self.tenant_phone, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(2)
        # Green line
        self.set_draw_color(45, 90, 61)
        self.set_line_width(0.8)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, "Generado por Plexify Studio", align="C")


def _fmt_cop(value):
    """Format integer as COP currency."""
    if not value:
        return "$0"
    return f"${value:,.0f}".replace(",", ".")


def generate_invoice_pdf(invoice, items, tenant) -> bytes:
    """Generate a PDF for the given invoice. Returns bytes."""
    pdf = InvoicePDF(
        tenant_name=getattr(tenant, "name", "") or "Negocio",
        tenant_nit=getattr(tenant, "nit", "") or "",
        tenant_address=getattr(tenant, "address", "") or "",
        tenant_phone=getattr(tenant, "phone", "") or "",
    )
    pdf.add_page()

    # Invoice title + number
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(130, 8, f"Factura {invoice.invoice_number}")
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(45, 90, 61)
    pdf.cell(0, 8, _fmt_cop(invoice.total), align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    # Date + status
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    date_str = invoice.issued_date.strftime("%d de %B de %Y") if invoice.issued_date else ""
    status_label = {"draft": "Borrador", "sent": "Enviada", "paid": "Pagada", "cancelled": "Anulada"}.get(invoice.status, invoice.status)
    terms = "Credito" if getattr(invoice, "payment_terms", "contado") == "credito" else "Contado"
    pdf.cell(0, 5, f"{date_str}  |  {status_label}  |  {terms}", new_x="LMARGIN", new_y="NEXT")
    if getattr(invoice, "due_date", None):
        pdf.cell(0, 5, f"Vencimiento: {invoice.due_date.strftime('%d/%m/%Y')}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)

    # Client box
    pdf.set_fill_color(248, 249, 251)
    pdf.set_font("Helvetica", "B", 10)
    y_start = pdf.get_y()
    pdf.cell(0, 7, f"  {invoice.client_name}", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    client_info = []
    if invoice.client_phone:
        client_info.append(f"Tel: {invoice.client_phone}")
    doc_type = getattr(invoice, "client_document_type", "CC") or "CC"
    if invoice.client_document:
        client_info.append(f"{doc_type}: {invoice.client_document}")
    if getattr(invoice, "client_email", None):
        client_info.append(f"Email: {invoice.client_email}")
    if client_info:
        pdf.cell(0, 5, f"  {' | '.join(client_info)}", fill=True, new_x="LMARGIN", new_y="NEXT")
    if getattr(invoice, "client_address", None):
        pdf.cell(0, 5, f"  Dir: {invoice.client_address}", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(8)

    # Items table header
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(140, 140, 140)
    pdf.cell(80, 6, "SERVICIO / PRODUCTO")
    pdf.cell(30, 6, "PROFESIONAL")
    pdf.cell(15, 6, "CANT.", align="C")
    pdf.cell(30, 6, "P/U", align="R")
    pdf.cell(0, 6, "TOTAL", align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.set_draw_color(230, 230, 230)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)

    # Items
    pdf.set_font("Helvetica", "", 9)
    for item in items:
        pdf.cell(80, 6, (item.service_name or "")[:40])
        pdf.cell(30, 6, (item.staff_name or "-")[:18])
        pdf.cell(15, 6, str(item.quantity), align="C")
        pdf.cell(30, 6, _fmt_cop(item.unit_price), align="R")
        pdf.cell(0, 6, _fmt_cop(item.total), align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(245, 245, 245)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())

    pdf.ln(4)

    # Totals
    x_label = 140
    x_value = 170
    pdf.set_font("Helvetica", "", 9)
    pdf.set_x(x_label)
    pdf.cell(30, 5, "Subtotal")
    pdf.cell(0, 5, _fmt_cop(invoice.subtotal), align="R", new_x="LMARGIN", new_y="NEXT")

    discount_amt = getattr(invoice, "discount_amount", 0) or 0
    if discount_amt > 0:
        pdf.set_text_color(220, 38, 38)
        pdf.set_x(x_label)
        discount_type = getattr(invoice, "discount_type", "")
        discount_value = getattr(invoice, "discount_value", 0)
        label = f"Descuento ({discount_value}%)" if discount_type == "percent" else "Descuento"
        pdf.cell(30, 5, label)
        pdf.cell(0, 5, f"-{_fmt_cop(discount_amt)}", align="R", new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(0, 0, 0)

    if invoice.tax_amount > 0:
        pdf.set_x(x_label)
        pct = int(invoice.tax_rate * 100) if invoice.tax_rate else 19
        pdf.cell(30, 5, f"IVA ({pct}%)")
        pdf.cell(0, 5, _fmt_cop(invoice.tax_amount), align="R", new_x="LMARGIN", new_y="NEXT")

    # Total line
    pdf.set_draw_color(30, 30, 30)
    pdf.set_line_width(0.5)
    pdf.line(x_label, pdf.get_y() + 1, 200, pdf.get_y() + 1)
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_x(x_label)
    pdf.cell(30, 7, "TOTAL")
    pdf.set_text_color(45, 90, 61)
    pdf.cell(0, 7, _fmt_cop(invoice.total), align="R", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    pdf.ln(8)

    # Payment method
    pm = invoice.payment_method or "N/A"
    pm_labels = {"efectivo": "Efectivo", "nequi": "Nequi", "daviplata": "Daviplata", "tarjeta": "Tarjeta", "transferencia": "Transferencia"}
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"Metodo de pago: {pm_labels.get(pm, pm)}", new_x="LMARGIN", new_y="NEXT")
    if invoice.notes:
        pdf.cell(0, 5, f"Notas: {invoice.notes[:100]}", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)

    # Return bytes
    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
