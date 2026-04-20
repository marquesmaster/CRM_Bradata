from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SqlEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OrigemEmpresa(str, Enum):
    pncp = "pncp"
    manual = "manual"
    import_csv = "import_csv"
    enriquecimento = "enriquecimento"
    indicacao = "indicacao"


class EmpresaStatus(str, Enum):
    prospect = "prospect"
    lead = "lead"
    cliente = "cliente"
    inativo = "inativo"


class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    cnpj: Mapped[str] = mapped_column(String(14), unique=True, index=True, nullable=False)
    razao_social: Mapped[str] = mapped_column(String(255), nullable=False)
    nome_fantasia: Mapped[str | None] = mapped_column(String(255))

    cnae_principal: Mapped[str | None] = mapped_column(String(10), index=True)
    cnae_principal_descricao: Mapped[str | None] = mapped_column(String(255))
    cnaes_secundarios: Mapped[list | None] = mapped_column(JSON)
    natureza_juridica: Mapped[str | None] = mapped_column(String(120))
    porte: Mapped[str | None] = mapped_column(String(40))
    sector: Mapped[str | None] = mapped_column(String(80), index=True)

    faturamento_estimado: Mapped[float | None] = mapped_column(Float, index=True)
    num_funcionarios: Mapped[int | None] = mapped_column(Integer)
    capital_social: Mapped[float | None] = mapped_column(Float)
    data_abertura: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    ativos_gov: Mapped[int | None] = mapped_column(Integer)
    ticket_medio: Mapped[float | None] = mapped_column(Float)
    stack: Mapped[list | None] = mapped_column(JSON)

    logradouro: Mapped[str | None] = mapped_column(String(255))
    numero: Mapped[str | None] = mapped_column(String(20))
    complemento: Mapped[str | None] = mapped_column(String(120))
    bairro: Mapped[str | None] = mapped_column(String(120))
    municipio: Mapped[str | None] = mapped_column(String(120), index=True)
    uf: Mapped[str | None] = mapped_column(String(2), index=True)
    cep: Mapped[str | None] = mapped_column(String(9))

    telefone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(180))
    website: Mapped[str | None] = mapped_column(String(255))
    linkedin_url: Mapped[str | None] = mapped_column(String(255))

    is_icp: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    icp_score: Mapped[int | None] = mapped_column(Integer, index=True)
    icp_motivo: Mapped[str | None] = mapped_column(Text)

    status: Mapped[EmpresaStatus] = mapped_column(
        SqlEnum(EmpresaStatus, name="empresa_status"),
        default=EmpresaStatus.prospect,
        nullable=False,
        index=True,
    )
    origem: Mapped[OrigemEmpresa] = mapped_column(
        SqlEnum(OrigemEmpresa, name="origem_empresa"),
        default=OrigemEmpresa.manual,
        nullable=False,
    )
    enriquecida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    observacoes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    contatos: Mapped[list["Contato"]] = relationship(  # noqa: F821
        "Contato", back_populates="empresa", cascade="all, delete-orphan"
    )
    oportunidades: Mapped[list["Oportunidade"]] = relationship(  # noqa: F821
        "Oportunidade", back_populates="empresa", cascade="all, delete-orphan"
    )
    leads: Mapped[list["Lead"]] = relationship(  # noqa: F821
        "Lead", back_populates="empresa", cascade="all, delete-orphan"
    )
