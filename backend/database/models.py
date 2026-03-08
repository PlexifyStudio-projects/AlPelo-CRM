from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Text, Float, JSON, ForeignKey
from sqlalchemy.orm import relationship
from database.connection import Base
from datetime import datetime


class Admin(Base):
    __tablename__ = "admin"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="admin")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    role = Column(String, nullable=False, default="Barbero")
    specialty = Column(String, nullable=True)
    bio = Column(Text, nullable=True)
    hire_date = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True)
    skills = Column(JSON, default=list)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    visits = relationship("VisitHistory", back_populates="staff")


class Client(Base):
    __tablename__ = "client"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String, unique=True, index=True, nullable=False)  # M20201 format
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    birthday = Column(Date, nullable=True)
    favorite_service = Column(String, nullable=True)
    preferred_barber_id = Column(Integer, ForeignKey("public.staff.id"), nullable=True)
    accepts_whatsapp = Column(Boolean, default=True)
    tags = Column(JSON, default=list)
    status_override = Column(String, nullable=True)  # manual override: activo, vip, en_riesgo, inactivo, nuevo
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    preferred_barber = relationship("Staff", foreign_keys=[preferred_barber_id])
    visits = relationship("VisitHistory", back_populates="client", order_by="VisitHistory.visit_date.desc()")
    notes = relationship("ClientNote", back_populates="client", order_by="ClientNote.created_at.desc()")


class VisitHistory(Base):
    __tablename__ = "visit_history"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("public.staff.id"), nullable=False)
    service_name = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)  # COP sin decimales
    visit_date = Column(Date, nullable=False)
    status = Column(String, nullable=False, default="completed")  # completed, no_show, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="visits")
    staff = relationship("Staff", back_populates="visits")


class ClientNote(Base):
    __tablename__ = "client_note"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(String, nullable=True)  # nombre de quien la creo
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client", back_populates="notes")


class AIConfig(Base):
    __tablename__ = "ai_config"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="Lina IA")
    system_prompt = Column(Text, nullable=False)
    model = Column(String, nullable=False, default="claude-sonnet-4-20250514")
    provider = Column(String, nullable=False, default="anthropic")
    temperature = Column(Float, nullable=False, default=0.7)
    max_tokens = Column(Integer, nullable=False, default=1024)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WhatsAppConversation(Base):
    __tablename__ = "whatsapp_conversation"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("public.client.id"), nullable=True)
    wa_contact_phone = Column(String, nullable=False)
    wa_contact_name = Column(String, nullable=True)
    last_message_at = Column(DateTime, nullable=True)
    is_ai_active = Column(Boolean, default=True)
    unread_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", foreign_keys=[client_id])
    messages = relationship("WhatsAppMessage", back_populates="conversation", order_by="WhatsAppMessage.created_at.asc()")


class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_message"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("public.whatsapp_conversation.id"), nullable=False)
    wa_message_id = Column(String, nullable=True, unique=True)  # WhatsApp message ID from API
    direction = Column(String, nullable=False)  # inbound, outbound
    content = Column(Text, nullable=False)
    message_type = Column(String, nullable=False, default="text")  # text, template, image, audio
    status = Column(String, nullable=False, default="sent")  # sent, delivered, read, failed
    sent_by = Column(String, nullable=True)  # staff name or 'lina_ia' or null (client)
    media_url = Column(Text, nullable=True)  # URL for images, stickers, videos, audio, documents
    media_mime_type = Column(String, nullable=True)  # e.g. image/jpeg, video/mp4, image/webp
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("WhatsAppConversation", back_populates="messages")
