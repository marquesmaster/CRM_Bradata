"""Geração de documentos DOCX a partir de templates.

Usa docxtpl (Jinja2 dentro do .docx). Placeholders disponíveis nos templates:

    {{ empresa.razao_social }}, {{ empresa.cnpj }}, {{ empresa.uf }},
    {{ empresa.cidade }}, {{ empresa.endereco_completo }},
    {{ contato.nome }}, {{ contato.cargo }}, {{ contato.email }},
    {{ deal.titulo }}, {{ deal.valor }}, {{ deal.valor_extenso }},
    {{ proposta.titulo }}, {{ proposta.valor }},
    {{ data_hoje }}, {{ remetente.nome }}, {{ remetente.email }},
    + variáveis customizadas passadas no payload.

Os arquivos ficam em /storage/templates e /storage/gerados (relativos ao app).
"""
from __future__ import annotations

import logging
import os
import re
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from app.models.documento import DocumentoTemplate
from app.models.empresa import Empresa
from app.models.oportunidade import Oportunidade
from app.models.proposta import Proposta
from app.models.user import User

log = logging.getLogger("documentos")

# Diretório de storage relativo à raiz do app
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR", "/app/storage")).resolve()
TEMPLATES_DIR = STORAGE_DIR / "templates"
GERADOS_DIR = STORAGE_DIR / "gerados"
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
GERADOS_DIR.mkdir(parents=True, exist_ok=True)


class DocumentoError(Exception):
    pass


def _brl(v: float | int | None) -> str:
    if v is None:
        return "R$ 0,00"
    s = f"R$ {float(v):,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _extenso(v: float | int | None) -> str:
    """Por extenso muito simplificado (usa libreria? pra MVP fica numérico)."""
    if v is None:
        return ""
    return f"{_brl(v)} (valor estimado em reais)"


def build_context(
    db: Session,
    *,
    empresa: Empresa | None = None,
    oportunidade: Oportunidade | None = None,
    proposta: Proposta | None = None,
    remetente: User | None = None,
    extras: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Constrói o dict de variáveis disponíveis pro template."""
    ctx: dict[str, Any] = {
        "data_hoje": date.today().strftime("%d/%m/%Y"),
        "data_iso": date.today().isoformat(),
        "agora": datetime.now().strftime("%d/%m/%Y %H:%M"),
    }

    # Empresa pode vir direto, da oportunidade, ou da proposta→oportunidade
    if not empresa and oportunidade:
        empresa = db.get(Empresa, oportunidade.empresa_id) if oportunidade.empresa_id else None
    if not empresa and proposta and proposta.oportunidade_id:
        op = db.get(Oportunidade, proposta.oportunidade_id)
        if op:
            empresa = db.get(Empresa, op.empresa_id) if op.empresa_id else None

    if empresa:
        endereco_parts = [
            empresa.logradouro,
            empresa.numero,
            empresa.complemento,
            empresa.bairro,
            empresa.municipio,
            empresa.uf,
            empresa.cep,
        ]
        ctx["empresa"] = {
            "id": empresa.id,
            "razao_social": empresa.razao_social or "",
            "nome_fantasia": empresa.nome_fantasia or "",
            "cnpj": _format_cnpj(empresa.cnpj),
            "cnpj_raw": empresa.cnpj or "",
            "porte": empresa.porte or "",
            "natureza_juridica": empresa.natureza_juridica or "",
            "logradouro": empresa.logradouro or "",
            "numero": empresa.numero or "",
            "complemento": empresa.complemento or "",
            "bairro": empresa.bairro or "",
            "cidade": empresa.municipio or "",
            "municipio": empresa.municipio or "",
            "uf": empresa.uf or "",
            "cep": empresa.cep or "",
            "endereco_completo": ", ".join(p for p in endereco_parts if p),
            "telefone": empresa.telefone or "",
            "email": empresa.email or "",
            "website": empresa.website or "",
        }

    if oportunidade:
        ctx["deal"] = {
            "id": oportunidade.id,
            "titulo": oportunidade.titulo or "",
            "valor": _brl(oportunidade.valor_estimado),
            "valor_raw": float(oportunidade.valor_estimado or 0),
            "valor_extenso": _extenso(oportunidade.valor_estimado),
            "probabilidade": oportunidade.probabilidade or 0,
            "data_fechamento_prevista": (
                oportunidade.data_fechamento_prevista.strftime("%d/%m/%Y")
                if oportunidade.data_fechamento_prevista else ""
            ),
            "descricao": oportunidade.descricao or "",
            "tags": ", ".join(oportunidade.tags or []),
        }

    if proposta:
        ctx["proposta"] = {
            "id": proposta.id,
            "titulo": proposta.titulo or "",
            "valor": _brl(getattr(proposta, "valor_total", None)),
            "valor_raw": float(getattr(proposta, "valor_total", 0) or 0),
            "descricao": getattr(proposta, "descricao", "") or "",
        }

    if remetente:
        ctx["remetente"] = {
            "nome": remetente.nome or "",
            "email": remetente.email or "",
            "cargo": getattr(remetente, "cargo", "") or "",
        }

    if extras:
        ctx.update(extras)

    return ctx


def _format_cnpj(cnpj: str | None) -> str:
    if not cnpj:
        return ""
    s = re.sub(r"\D", "", cnpj)
    if len(s) != 14:
        return cnpj
    return f"{s[:2]}.{s[2:5]}.{s[5:8]}/{s[8:12]}-{s[12:]}"


def list_template_variables(file_path: str) -> list[str]:
    """Inspeciona um .docx e extrai as variáveis Jinja usadas nele."""
    try:
        from docxtpl import DocxTemplate
        doc = DocxTemplate(file_path)
        return sorted(doc.get_undeclared_template_variables())
    except Exception as e:
        log.warning("Falha extraindo variáveis de %s: %s", file_path, e)
        return []


def render_template_to_file(template: DocumentoTemplate, context: dict[str, Any], out_path: Path) -> None:
    """Renderiza o template com o contexto e salva em out_path."""
    try:
        from docxtpl import DocxTemplate
    except ImportError:
        raise DocumentoError("docxtpl não está instalado no servidor. pip install docxtpl")

    src = Path(template.file_path)
    if not src.exists():
        raise DocumentoError(f"Template não encontrado em {src}")
    doc = DocxTemplate(str(src))
    try:
        doc.render(context)
    except Exception as e:
        raise DocumentoError(f"Erro ao renderizar template: {e}")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(out_path))


def slug(s: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", (s or "").lower().strip())
    return s[:60] or "documento"
