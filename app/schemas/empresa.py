from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.empresa import EmpresaStatus, OrigemEmpresa


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
    sector: str | None = None

    faturamento_estimado: float | None = None
    num_funcionarios: int | None = None
    capital_social: float | None = None
    data_abertura: datetime | None = None

    ativos_gov: int | None = None
    ticket_medio: float | None = None
    stack: list[str] | None = None

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
    status: EmpresaStatus = EmpresaStatus.prospect
    owner_id: int | None = None


class EmpresaUpdate(BaseModel):
    razao_social: str | None = None
    nome_fantasia: str | None = None
    sector: str | None = None
    status: EmpresaStatus | None = None
    telefone: str | None = None
    email: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    owner_id: int | None = None
    observacoes: str | None = None
    is_icp: bool | None = None
    faturamento_estimado: float | None = None
    num_funcionarios: int | None = None
    ativos_gov: int | None = None
    ticket_medio: float | None = None
    stack: list[str] | None = None


class EmpresaOut(EmpresaBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_icp: bool
    icp_score: int | None
    icp_motivo: str | None
    status: EmpresaStatus
    origem: OrigemEmpresa
    owner_id: int | None
    enriquecida_em: datetime | None
    created_at: datetime
    updated_at: datetime

    contatos_n: int = 0
    contracts_pncp: int = 0
    valor_total_contratos: float = 0.0
    classificacao_valor: str = "baixo"       # alto | medio | baixo
    faixa_faturamento: str | None = None     # "Até R$ 81 mil" etc.


class EmpresaFilter(BaseModel):
    cnpj: str | None = None
    razao_social: str | None = None
    uf: str | None = None
    municipio: str | None = None
    is_icp: bool | None = None
    owner_id: int | None = None
    origem: OrigemEmpresa | None = None
    status: EmpresaStatus | None = None
    faturamento_min: float | None = None
    cnae_principal: str | None = None
    sector: str | None = None
