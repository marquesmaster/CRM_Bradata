from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole, UserStatus


class UserBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: UserRole = UserRole.bdr
    status: UserStatus = UserStatus.ativo
    is_active: bool = True
    team: str | None = None


class UserCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.bdr
    team: str | None = None
    status: UserStatus = UserStatus.ativo


class UserInvite(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: UserRole = UserRole.bdr
    team: str | None = None


class UserUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=120)
    role: UserRole | None = None
    status: UserStatus | None = None
    is_active: bool | None = None
    team: str | None = None
    senha: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    last_seen_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserStats(BaseModel):
    user_id: int
    deals: int
    won: int
    open: int
    lost: int
    revenue: float
    win_rate: float
    activities_30d: int
    leads: int
    leads_qualificados: int


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str
