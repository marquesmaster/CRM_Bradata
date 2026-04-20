from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.oportunidade import OportunidadeStatus


class PipelineEstagioIn(BaseModel):
    nome: str
    ordem: int
    probabilidade: int = Field(default=10, ge=0, le=100)
    color: str | None = None
    is_ganho: bool = False
    is_perda: bool = False


class PipelineEstagioOut(PipelineEstagioIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    pipeline_id: int


class PipelineCreate(BaseModel):
    nome: str
    descricao: str | None = None
    ativo: bool = True
    estagios: list[PipelineEstagioIn] = []


class PipelineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nome: str
    descricao: str | None
    ativo: bool
    estagios: list[PipelineEstagioOut]
    created_at: datetime


class OportunidadeBase(BaseModel):
    titulo: str
    empresa_id: int
    contato_id: int | None = None
    pipeline_id: int
    estagio_id: int
    valor_estimado: float | None = None
    probabilidade: int | None = Field(default=None, ge=0, le=100)
    data_fechamento_prevista: date | None = None
    descricao: str | None = None
    pncp_numero_controle: str | None = None
    tags: list[str] | None = None


class OportunidadeCreate(OportunidadeBase):
    owner_id: int | None = None


class OportunidadeUpdate(BaseModel):
    titulo: str | None = None
    contato_id: int | None = None
    estagio_id: int | None = None
    valor_estimado: float | None = None
    probabilidade: int | None = None
    data_fechamento_prevista: date | None = None
    descricao: str | None = None
    owner_id: int | None = None
    tags: list[str] | None = None


class OportunidadeOut(OportunidadeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: OportunidadeStatus
    motivo_perda: str | None
    data_fechamento_real: date | None
    owner_id: int | None
    created_at: datetime
    updated_at: datetime


class OportunidadeCloseRequest(BaseModel):
    status: OportunidadeStatus
    motivo_perda: str | None = None
