from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.empresa import OrigemEmpresa


def _only_digits(v: str | None) -> str | None:
    if v is None:
        return None
    return "".join(ch for ch in v if ch.isdigit())


class EmpresaBase(BaseModel):
    cnpj: str = Field(min_length=14, max_length=18)
    razao_social: str = Field(min_length=2, max_length=255)
    nome_fantasia: str | None = Field(default=None, max_length=255)
    cnae_principal: str | None = None
    cnae_principal_descricao: str | None = None
    cnaes_secundarios: list[Any] | None = None
    natureza_juridica: str | None = None
    porte: str | None = None

    faturamento_estimado: float | None = None
    num_funcionarios: int | None = None
    capital_social: float | None = None
    data_abertura: datetime | None = None

    logradouro: str | None = None
    numero: str | None = None
    complemento: str | None = None
    bairro: str | None = None
    municipio: str | None = None
    uf: str | None = Field(default=None, max_length=2)
    cep: str | None = None

    telefone: str | None = None
    email: str | None = None
    website: str | None = None
    linkedin_url: str | None = None

    observacoes: str | None = None

    @field_validator("cnpj")
    @classmethod
    def clean_cnpj(cls, v: str) -> str:
        digits = _only_digits(v) or ""
        if len(digits) != 14:
            raise ValueError("CNPJ deve ter 14 dígitos")
        return digits


class EmpresaCreate(EmpresaBase):
    origem: OrigemEmpresa = OrigemEmpresa.manual
    owner_id: int | None = None


class EmpresaUpdate(BaseModel):
    razao_social: str | None = None
    nome_fantasia: str | None = None
    telefone: str | None = None
    email: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    owner_id: int | None = None
    observacoes: str | None = None
    is_icp: bool | None = None
    faturamento_estimado: float | None = None
    num_funcionarios: int | None = None


class EmpresaOut(EmpresaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_icp: bool
    icp_score: int | None
    icp_motivo: str | None
    origem: OrigemEmpresa
    owner_id: int | None
    enriquecida_em: datetime | None
    created_at: datetime
    updated_at: datetime


class EmpresaFilter(BaseModel):
    cnpj: str | None = None
    razao_social: str | None = None
    uf: str | None = None
    municipio: str | None = None
    is_icp: bool | None = None
    owner_id: int | None = None
    origem: OrigemEmpresa | None = None
    faturamento_min: float | None = None
    cnae_principal: str | None = None
