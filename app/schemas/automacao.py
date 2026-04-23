from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.automacao import AutomacaoKind


class AutomacaoBase(BaseModel):
    nome: str
    kind: AutomacaoKind
    descricao: str | None = None
    ativo: bool = True
    config: dict[str, Any] | None = None
    assunto: str | None = None
    corpo: str | None = None


class AutomacaoCreate(AutomacaoBase):
    pass


class AutomacaoUpdate(BaseModel):
    nome: str | None = None
    descricao: str | None = None
    ativo: bool | None = None
    config: dict[str, Any] | None = None
    assunto: str | None = None
    corpo: str | None = None


class AutomacaoOut(AutomacaoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    executada_n_vezes: int
    ultima_execucao: datetime | None
    created_at: datetime
    updated_at: datetime
