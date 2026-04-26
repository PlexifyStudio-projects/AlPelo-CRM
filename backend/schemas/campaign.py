from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CampaignCreate(BaseModel):
    name: str
    campaign_type: Optional[str] = "promo"
    message_body: Optional[str] = None
    segment_filters: Optional[dict] = {}
    created_by: Optional[str] = None

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    status: Optional[str] = None
    message_body: Optional[str] = None
    meta_template_name: Optional[str] = None
    segment_filters: Optional[dict] = None

class CampaignResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    campaign_type: Optional[str] = None
    status: str = "draft"
    message_body: Optional[str] = None
    meta_template_name: Optional[str] = None
    meta_template_id: Optional[str] = None
    meta_status: Optional[str] = None
    segment_filters: Optional[dict] = {}
    audience_count: int = 0
    sent_count: int = 0
    failed_count: int = 0
    responded_count: int = 0
    ai_variants: Optional[list] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ImportRowResult(BaseModel):
    line: int                                 # 1-indexed spreadsheet line (header is 1, data starts at 2)
    status: str                               # "imported" | "duplicate" | "error"
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[str] = None
    client_id: Optional[str] = None           # assigned id when imported
    reason: Optional[str] = None              # why skipped/errored
    existing_client_id: Optional[str] = None  # for duplicates: id of the client already in DB
    existing_client_name: Optional[str] = None


class ImportResult(BaseModel):
    imported: int = 0
    skipped: int = 0
    errors: List[str] = []
    total: int = 0
    rows: List[ImportRowResult] = []
