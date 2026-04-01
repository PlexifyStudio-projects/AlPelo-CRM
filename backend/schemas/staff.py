from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


class StaffCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str = "Barbero"
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool = True
    skills: List[str] = []
    rating: Optional[float] = None
    color: Optional[str] = None
    photo_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class StaffUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None
    skills: Optional[List[str]] = None
    rating: Optional[float] = None
    color: Optional[str] = None
    photo_url: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None

class StaffResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: str
    specialty: Optional[str] = None
    bio: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: bool
    skills: List[str] = []
    rating: Optional[float] = None
    color: Optional[str] = None
    photo_url: Optional[str] = None
    username: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StaffCredentialsUpdate(BaseModel):
    username: str
    password: str
