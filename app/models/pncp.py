from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PncpContrato(Base):
    __tablename__ = "pncp_contratos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero_controle_pncp: Mapped[str] = mapped_column(
        String(60), unique=True, index=True, nullable=False
    )
    pncp_doc_id: Mapped[str | None] = mapped_column(String(64), index=True)

    titulo: Mapped[str | None] = mapped_column(String(500))
    descricao: Mapped[str | None] = mapped_column(Text)
    item_url: Mapped[str | None] = mapped_column(String(500))

    orgao_cnpj: Mapped[str] = mapped_column(String(14), index=True, nullable=False)
    orgao_nome: Mapped[str | None] = mapped_column(String(255))
    unidade_nome: Mapped[str | None] = mapped_column(String(255))

    ano: Mapped[str | None] = mapped_column(String(4), index=True)
    numero_sequencial: Mapped[str | None] = mapped_column(String(20))
    numero_sequencial_compra_ata: Mapped[str | None] = mapped_column(String(20))

    esfera_nome: Mapped[str | None] = mapped_column(String(40))
    poder_nome: Mapped[str | None] = mapped_column(String(40))
    municipio_nome: Mapped[str | None] = mapped_column(String(120), index=True)
    uf: Mapped[str | None] = mapped_column(String(2), index=True)

    modalidade_licitacao_nome: Mapped[str | None] = mapped_column(String(120))
    situacao_nome: Mapped[str | None] = mapped_column(String(60))
    tipo_contrato_nome: Mapped[str | None] = mapped_column(String(120))

    data_publicacao_pncp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    data_assinatura: Mapped[date | None] = mapped_column(Date)
    data_inicio_vigencia: Mapped[date | None] = mapped_column(Date)
    data_fim_vigencia: Mapped[date | None] = mapped_column(Date)

    valor_global: Mapped[float | None] = mapped_column(Float)
    cancelado: Mapped[bool] = mapped_column(Boolean, default=False)

    numero_controle_pncp_compra: Mapped[str | None] = mapped_column(String(60), index=True)

    detalhe_processado: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    itens_processados: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resultados_processados: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    raw_json: Mapped[dict | None] = mapped_column(JSON)
    detalhe_json: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class PncpCompra(Base):
    __tablename__ = "pncp_compras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    numero_controle_pncp: Mapped[str] = mapped_column(
        String(60), unique=True, index=True, nullable=False
    )
    orgao_cnpj: Mapped[str] = mapped_column(String(14), index=True, nullable=False)
    ano_compra: Mapped[int] = mapped_column(Integer, nullable=False)
    sequencial_compra: Mapped[int] = mapped_column(Integer, nullable=False)
    numero_compra: Mapped[str | None] = mapped_column(String(40))
    processo: Mapped[str | None] = mapped_column(String(60))

    orgao_razao_social: Mapped[str | None] = mapped_column(String(255))
    unidade_nome: Mapped[str | None] = mapped_column(String(255))
    unidade_uf_sigla: Mapped[str | None] = mapped_column(String(2), index=True)
    unidade_municipio: Mapped[str | None] = mapped_column(String(120))

    modalidade_nome: Mapped[str | None] = mapped_column(String(120))
    modo_disputa_nome: Mapped[str | None] = mapped_column(String(120))
    objeto_compra: Mapped[str | None] = mapped_column(Text)
    informacao_complementar: Mapped[str | None] = mapped_column(Text)

    valor_total_estimado: Mapped[float | None] = mapped_column(Float)
    valor_total_homologado: Mapped[float | None] = mapped_column(Float)
    srp: Mapped[bool | None] = mapped_column(Boolean)

    data_publicacao_pncp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    data_abertura_proposta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    data_encerramento_proposta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    situacao_compra_nome: Mapped[str | None] = mapped_column(String(60))
    link_sistema_origem: Mapped[str | None] = mapped_column(String(500))

    itens_processados: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resultados_processados: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    raw_json: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    itens: Mapped[list["PncpCompraItem"]] = relationship(
        "PncpCompraItem", back_populates="compra", cascade="all, delete-orphan"
    )


class PncpCompraItem(Base):
    __tablename__ = "pncp_compra_itens"
    __table_args__ = (
        UniqueConstraint("compra_id", "numero_item", name="uq_compra_item"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compra_id: Mapped[int] = mapped_column(
        ForeignKey("pncp_compras.id", ondelete="CASCADE"), nullable=False, index=True
    )
    numero_item: Mapped[int] = mapped_column(Integer, nullable=False)
    descricao: Mapped[str | None] = mapped_column(Text)
    material_ou_servico: Mapped[str | None] = mapped_column(String(2))
    material_ou_servico_nome: Mapped[str | None] = mapped_column(String(40))
    valor_unitario_estimado: Mapped[float | None] = mapped_column(Float)
    valor_total: Mapped[float | None] = mapped_column(Float)
    quantidade: Mapped[float | None] = mapped_column(Float)
    unidade_medida: Mapped[str | None] = mapped_column(String(20))
    criterio_julgamento_nome: Mapped[str | None] = mapped_column(String(120))
    situacao_compra_item_nome: Mapped[str | None] = mapped_column(String(60))
    tem_resultado: Mapped[bool | None] = mapped_column(Boolean)

    resultados_processados: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    raw_json: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    compra: Mapped["PncpCompra"] = relationship("PncpCompra", back_populates="itens")
    resultados: Mapped[list["PncpResultado"]] = relationship(
        "PncpResultado", back_populates="item", cascade="all, delete-orphan"
    )


class PncpResultado(Base):
    __tablename__ = "pncp_resultados"
    __table_args__ = (
        UniqueConstraint("item_id", "sequencial_resultado", name="uq_resultado"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(
        ForeignKey("pncp_compra_itens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    numero_controle_pncp_compra: Mapped[str | None] = mapped_column(String(60), index=True)
    numero_item: Mapped[int | None] = mapped_column(Integer)
    sequencial_resultado: Mapped[int] = mapped_column(Integer, default=1)

    ni_fornecedor: Mapped[str | None] = mapped_column(String(20), index=True)
    tipo_pessoa: Mapped[str | None] = mapped_column(String(2))
    nome_razao_social_fornecedor: Mapped[str | None] = mapped_column(String(255))
    porte_fornecedor_nome: Mapped[str | None] = mapped_column(String(60))
    natureza_juridica_nome: Mapped[str | None] = mapped_column(String(120))
    codigo_pais: Mapped[str | None] = mapped_column(String(10))

    valor_total_homologado: Mapped[float | None] = mapped_column(Float)
    valor_unitario_homologado: Mapped[float | None] = mapped_column(Float)
    quantidade_homologada: Mapped[float | None] = mapped_column(Float)
    percentual_desconto: Mapped[float | None] = mapped_column(Float)

    situacao_nome: Mapped[str | None] = mapped_column(String(60))
    ordem_classificacao_srp: Mapped[int | None] = mapped_column(Integer)
    data_resultado: Mapped[date | None] = mapped_column(Date)

    empresa_id: Mapped[int | None] = mapped_column(
        ForeignKey("empresas.id", ondelete="SET NULL"), index=True
    )

    raw_json: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    item: Mapped["PncpCompraItem"] = relationship("PncpCompraItem", back_populates="resultados")
