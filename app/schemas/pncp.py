from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class PncpContratoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    numero_controle_pncp: str
    titulo: str | None
    descricao: str | None
    orgao_cnpj: str
    orgao_nome: str | None
    unidade_nome: str | None
    ano: str | None
    numero_sequencial: str | None
    numero_sequencial_compra_ata: str | None
    uf: str | None
    municipio_nome: str | None
    modalidade_licitacao_nome: str | None
    situacao_nome: str | None
    data_publicacao_pncp: datetime | None
    data_assinatura: date | None
    data_inicio_vigencia: date | None
    data_fim_vigencia: date | None
    valor_global: float | None
    tipo_contrato_nome: str | None
    numero_controle_pncp_compra: str | None
    detalhe_processado: bool
    itens_processados: bool
    resultados_processados: bool


class PncpCompraOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    numero_controle_pncp: str
    orgao_cnpj: str
    ano_compra: int
    sequencial_compra: int
    numero_compra: str | None
    processo: str | None
    orgao_razao_social: str | None
    unidade_nome: str | None
    unidade_uf_sigla: str | None
    unidade_municipio: str | None
    modalidade_nome: str | None
    objeto_compra: str | None
    valor_total_estimado: float | None
    valor_total_homologado: float | None
    srp: bool | None
    data_publicacao_pncp: datetime | None
    situacao_compra_nome: str | None


class PncpCompraItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    compra_id: int
    numero_item: int
    descricao: str | None
    material_ou_servico_nome: str | None
    valor_unitario_estimado: float | None
    valor_total: float | None
    quantidade: float | None
    unidade_medida: str | None
    situacao_compra_item_nome: str | None
    tem_resultado: bool | None


class PncpResultadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    item_id: int
    numero_item: int | None
    sequencial_resultado: int
    ni_fornecedor: str | None
    tipo_pessoa: str | None
    nome_razao_social_fornecedor: str | None
    porte_fornecedor_nome: str | None
    natureza_juridica_nome: str | None
    valor_total_homologado: float | None
    valor_unitario_homologado: float | None
    quantidade_homologada: float | None
    situacao_nome: str | None
    data_resultado: date | None
    empresa_id: int | None


class EtlRunRequest(BaseModel):
    tipos_documento: str = "contrato"
    keywords: list[str] = []
    ufs: list[str] = []
    status: str = "vigente"
    max_paginas: int | None = None


class EtlRunResult(BaseModel):
    etapa: str
    itens_processados: int
    itens_novos: int
    iniciado_em: datetime
    finalizado_em: datetime
    erros: int = 0
