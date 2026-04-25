"""Endpoints de templates de documento e geração."""
from __future__ import annotations

import os
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.models.documento import DocumentoGerado, DocumentoTemplate, TemplateKind
from app.models.empresa import Empresa
from app.models.oportunidade import Oportunidade
from app.models.proposta import Proposta
from app.services.documentos import (
    DocumentoError,
    GERADOS_DIR,
    TEMPLATES_DIR,
    build_context,
    list_template_variables,
    render_template_to_file,
    slug,
)
from app.services.historico import log_event
from app.services.soft_delete import filter_active, soft_delete

router = APIRouter()


# -------- Templates --------

@router.get("/templates")
def list_templates(
    db: DBSession,
    _: CurrentUser,
    kind: TemplateKind | None = None,
    ativo: bool | None = True,
):
    q = filter_active(db.query(DocumentoTemplate), DocumentoTemplate)
    if kind:
        q = q.filter(DocumentoTemplate.kind == kind)
    if ativo is not None:
        q = q.filter(DocumentoTemplate.ativo == ativo)
    rows = q.order_by(DocumentoTemplate.kind, DocumentoTemplate.nome).all()
    return [
        {
            "id": t.id,
            "nome": t.nome,
            "descricao": t.descricao,
            "kind": t.kind.value,
            "file_name_original": t.file_name_original,
            "variaveis_disponiveis": t.variaveis_disponiveis,
            "ativo": t.ativo,
            "created_at": t.created_at,
        }
        for t in rows
    ]


@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def upload_template(
    db: DBSession,
    current: AdminUser,
    nome: str = Form(...),
    kind: TemplateKind = Form(...),
    descricao: str | None = Form(None),
    file: UploadFile = File(...),
):
    """Sobe um .docx como template. Variáveis Jinja são extraídas automaticamente."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Apenas arquivos .docx são aceitos")

    tpl = DocumentoTemplate(
        nome=nome,
        kind=kind,
        descricao=descricao,
        file_path="",  # será setado após salvar
        file_name_original=file.filename,
        ativo=True,
        created_by_id=current.id,
    )
    db.add(tpl)
    db.flush()  # gera o id

    safe_name = f"{tpl.id}_{slug(nome)}.docx"
    dest = TEMPLATES_DIR / safe_name
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    tpl.file_path = str(dest)

    # Extrai variáveis automaticamente
    try:
        vars_list = list_template_variables(str(dest))
        tpl.variaveis_disponiveis = [{"nome": v, "label": v.replace("_", " ").title()} for v in vars_list]
    except Exception:
        tpl.variaveis_disponiveis = []

    log_event(db, current.id, "documento_template", tpl.id, "criou",
              {"nome": tpl.nome, "kind": tpl.kind.value})
    db.commit()
    db.refresh(tpl)
    return {
        "id": tpl.id, "nome": tpl.nome, "kind": tpl.kind.value,
        "variaveis_disponiveis": tpl.variaveis_disponiveis,
    }


@router.delete("/templates/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(tpl_id: int, db: DBSession, current: AdminUser):
    tpl = db.get(DocumentoTemplate, tpl_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    log_event(db, current.id, "documento_template", tpl.id, "excluiu", {"nome": tpl.nome})
    soft_delete(db, current.id, tpl)
    db.commit()


@router.get("/templates/{tpl_id}/variaveis")
def template_variables(tpl_id: int, db: DBSession, _: CurrentUser):
    """Lista variáveis Jinja usadas no DOCX (re-extração ao vivo)."""
    tpl = db.get(DocumentoTemplate, tpl_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template não encontrado")
    vars_list = list_template_variables(tpl.file_path)
    return {"id": tpl.id, "nome": tpl.nome, "variaveis": vars_list}


# -------- Geração --------

class GerarPayload(BaseModel):
    template_id: int
    empresa_id: int | None = None
    oportunidade_id: int | None = None
    proposta_id: int | None = None
    extras: dict | None = None        # variáveis customizadas


@router.post("/gerar", status_code=status.HTTP_201_CREATED)
def gerar_documento(payload: GerarPayload, db: DBSession, current: CurrentUser):
    tpl = db.get(DocumentoTemplate, payload.template_id)
    if not tpl or tpl.deleted_at:
        raise HTTPException(status_code=404, detail="Template não encontrado")

    empresa = db.get(Empresa, payload.empresa_id) if payload.empresa_id else None
    oportunidade = db.get(Oportunidade, payload.oportunidade_id) if payload.oportunidade_id else None
    proposta = db.get(Proposta, payload.proposta_id) if payload.proposta_id else None

    context = build_context(
        db,
        empresa=empresa,
        oportunidade=oportunidade,
        proposta=proposta,
        remetente=current,
        extras=payload.extras,
    )

    # Gera arquivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_name = oportunidade.titulo if oportunidade else proposta.titulo if proposta else tpl.nome
    out_name = f"{tpl.kind.value}_{slug(base_name)}_{timestamp}.docx"
    out_path = GERADOS_DIR / out_name
    try:
        render_template_to_file(tpl, context, out_path)
    except DocumentoError as e:
        raise HTTPException(status_code=500, detail=str(e))

    doc = DocumentoGerado(
        template_id=tpl.id,
        nome=base_name[:240],
        file_path=str(out_path),
        variables_used=context,
        oportunidade_id=oportunidade.id if oportunidade else None,
        proposta_id=proposta.id if proposta else None,
        empresa_id=empresa.id if empresa else None,
        created_by_id=current.id,
    )
    db.add(doc)
    db.flush()
    log_event(db, current.id, "documento", doc.id, "gerou",
              {"template_id": tpl.id, "template_nome": tpl.nome, "oportunidade_id": doc.oportunidade_id})
    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "nome": doc.nome,
        "template_id": tpl.id,
        "download_url": f"/api/v1/documentos/{doc.id}/download",
        "created_at": doc.created_at,
    }


@router.get("")
def list_documentos(
    db: DBSession,
    _: CurrentUser,
    oportunidade_id: int | None = None,
    proposta_id: int | None = None,
    empresa_id: int | None = None,
    limit: int = Query(100, ge=1, le=500),
):
    q = filter_active(db.query(DocumentoGerado), DocumentoGerado)
    if oportunidade_id:
        q = q.filter(DocumentoGerado.oportunidade_id == oportunidade_id)
    if proposta_id:
        q = q.filter(DocumentoGerado.proposta_id == proposta_id)
    if empresa_id:
        q = q.filter(DocumentoGerado.empresa_id == empresa_id)
    rows = q.order_by(DocumentoGerado.created_at.desc()).limit(limit).all()
    return [
        {
            "id": d.id, "nome": d.nome, "template_id": d.template_id,
            "oportunidade_id": d.oportunidade_id, "empresa_id": d.empresa_id,
            "created_at": d.created_at, "created_by_id": d.created_by_id,
        }
        for d in rows
    ]


@router.get("/{doc_id}/download")
def download_documento(doc_id: int, db: DBSession, _: CurrentUser):
    doc = db.get(DocumentoGerado, doc_id)
    if not doc or doc.deleted_at:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    if not Path(doc.file_path).exists():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no storage")
    safe = f"{slug(doc.nome)}.docx"
    return FileResponse(
        doc.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe,
    )


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_documento(doc_id: int, db: DBSession, current: CurrentUser):
    doc = db.get(DocumentoGerado, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    log_event(db, current.id, "documento", doc.id, "excluiu", {"nome": doc.nome})
    soft_delete(db, current.id, doc)
    db.commit()
