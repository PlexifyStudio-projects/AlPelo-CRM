from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenRequest(BaseModel):
    user_id: int
    username: str
    role: str

class UserCredentials(BaseModel):
    user_id: int
    username: str
    role: str

class AdminSetupRequest(BaseModel):
    name: str
    email: str
    username: str
    password: str
    phone: Optional[str] = None

class AdminResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    username: str
    role: str
    is_active: bool
    tenant_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AdminProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    username: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str

class ToggleAllAIRequest(BaseModel):
    enable: bool

class ToggleAllAIResponse(BaseModel):
    updated: int
    is_active: bool
