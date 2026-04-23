from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.etl_run import EtlRunStatus


class EtlRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tipo: str
    status: EtlRunStatus
    iniciado_em: datetime
    finalizado_em: datetime | None
    duracao_seg: float | None
    payload: dict[str, Any] | None
    resumo: dict[str, Any] | None
    contratos_a_processar: int
    contratos_ok: int
    contratos_com_erro: int
    itens_novos: int
    empresas_sincronizadas: int
    ai_processados: int
    mensagem_erro: str | None
    triggered_by_id: int | None
    created_at: datetime
    updated_at: datetime
