from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.lead import LeadStatus


class LeadBase(BaseModel):
    empresa_id: int
    contato_id: int | None = None
    origem: str = "manual"
    status: LeadStatus = LeadStatus.novo
    score: int = Field(default=0, ge=0, le=100)
    observacoes: str | None = None


class LeadCreate(LeadBase):
    owner_id: int | None = None


class LeadUpdate(BaseModel):
    contato_id: int | None = None
    status: LeadStatus | None = None
    score: int | None = Field(default=None, ge=0, le=100)
    owner_id: int | None = None
    motivo_desqualificacao: str | None = None
    observacoes: str | None = None


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    owner_id: int | None
    qualificado_em: datetime | None
    convertido_em: datetime | None
    oportunidade_id: int | None
    created_at: datetime
    updated_at: datetime


class LeadConvert(BaseModel):
    titulo_oportunidade: str
    pipeline_id: int
    estagio_id: int
    valor_estimado: float | None = None
    contato_id: int | None = None
