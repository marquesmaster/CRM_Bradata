from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    nome: str = Field(min_length=2, max_length=120)
    email: EmailStr
    role: UserRole = UserRole.bdr
    is_active: bool = True


class UserCreate(UserBase):
    senha: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=120)
    role: UserRole | None = None
    is_active: bool | None = None
    senha: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str
