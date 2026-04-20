from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.atividade import AtividadePrioridade, AtividadeStatus, TipoAtividade


class AtividadeBase(BaseModel):
    tipo: TipoAtividade
    titulo: str
    descricao: str | None = None
    status: AtividadeStatus = AtividadeStatus.concluida
    prioridade: AtividadePrioridade = AtividadePrioridade.media
    data_atividade: datetime | None = None
    due_date: datetime | None = None
    duracao_min: int | None = None
    resultado: str | None = None
    empresa_id: int | None = None
    contato_id: int | None = None
    oportunidade_id: int | None = None
    lead_id: int | None = None
    assignee_id: int | None = None


class AtividadeCreate(AtividadeBase):
    pass


class AtividadeUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    status: AtividadeStatus | None = None
    prioridade: AtividadePrioridade | None = None
    data_atividade: datetime | None = None
    due_date: datetime | None = None
    duracao_min: int | None = None
    resultado: str | None = None
    assignee_id: int | None = None


class AtividadeOut(AtividadeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    concluida_em: datetime | None
    created_at: datetime
    updated_at: datetime
