from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ContatoBase(BaseModel):
    empresa_id: int
    nome: str = Field(min_length=2, max_length=180)
    cargo: str | None = None
    departamento: str | None = None
    email: EmailStr | None = None
    telefone: str | None = None
    celular: str | None = None
    linkedin_url: str | None = None
    decisor: bool = False
    principal: bool = False


class ContatoCreate(ContatoBase):
    owner_id: int | None = None


class ContatoUpdate(BaseModel):
    nome: str | None = None
    cargo: str | None = None
    departamento: str | None = None
    email: EmailStr | None = None
    telefone: str | None = None
    celular: str | None = None
    linkedin_url: str | None = None
    decisor: bool | None = None
    principal: bool | None = None
    owner_id: int | None = None


class ContatoOut(ContatoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int | None
    created_at: datetime
    updated_at: datetime
