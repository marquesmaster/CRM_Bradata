from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.tarefa import TarefaPrioridade, TarefaStatus


class TarefaBase(BaseModel):
    titulo: str
    descricao: str | None = None
    due_date: datetime | None = None
    status: TarefaStatus = TarefaStatus.pendente
    prioridade: TarefaPrioridade = TarefaPrioridade.media
    assignee_id: int
    empresa_id: int | None = None
    oportunidade_id: int | None = None
    lead_id: int | None = None


class TarefaCreate(TarefaBase):
    pass


class TarefaUpdate(BaseModel):
    titulo: str | None = None
    descricao: str | None = None
    due_date: datetime | None = None
    status: TarefaStatus | None = None
    prioridade: TarefaPrioridade | None = None
    assignee_id: int | None = None


class TarefaOut(TarefaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_by_id: int | None
    concluida_em: datetime | None
    created_at: datetime
    updated_at: datetime
