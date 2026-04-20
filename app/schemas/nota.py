from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotaCreate(BaseModel):
    conteudo: str
    empresa_id: int | None = None
    contato_id: int | None = None
    oportunidade_id: int | None = None
    lead_id: int | None = None


class NotaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conteudo: str
    empresa_id: int | None
    contato_id: int | None
    oportunidade_id: int | None
    lead_id: int | None
    user_id: int
    created_at: datetime
