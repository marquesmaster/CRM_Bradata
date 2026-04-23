from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.proposta import PropostaStatus


class PropostaBase(BaseModel):
    oportunidade_id: int
    titulo: str
    numero: str | None = None
    versao: int = 1
    status: PropostaStatus = PropostaStatus.rascunho
    valor_total: float | None = None
    desconto_percentual: float | None = None
    escopo: str | None = None
    condicoes_pagamento: str | None = None
    prazo_execucao: str | None = None
    perfis: list[dict[str, Any]] | None = None
    pdf_url: str | None = None
    validade_em: date | None = None


class PropostaCreate(PropostaBase):
    pass


class PropostaUpdate(BaseModel):
    titulo: str | None = None
    numero: str | None = None
    status: PropostaStatus | None = None
    valor_total: float | None = None
    desconto_percentual: float | None = None
    escopo: str | None = None
    condicoes_pagamento: str | None = None
    prazo_execucao: str | None = None
    perfis: list[dict[str, Any]] | None = None
    pdf_url: str | None = None
    validade_em: date | None = None
    motivo_rejeicao: str | None = None


class PropostaOut(PropostaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    enviada_em: datetime | None
    aceita_em: datetime | None
    rejeitada_em: datetime | None
    motivo_rejeicao: str | None
    created_by_id: int | None
    created_at: datetime
    updated_at: datetime
