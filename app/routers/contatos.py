from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func

from app.core.deps import CurrentUser, DBSession
from app.models.atividade import Atividade, AtividadeStatus, TipoAtividade
from app.models.automacao import Automacao, AutomacaoKind
from app.models.contato import Contato
from app.models.empresa import Empresa
from app.schemas.common import Page
from app.schemas.contato import ContatoCreate, ContatoOut, ContatoUpdate
from app.services import google_oauth as gauth
from app.services.smtp import SMTPError, enviar_email, render_template
from app.services.soft_delete import soft_delete, restore, filter_active

router = APIRouter()


class EnviarEmailIn(BaseModel):
    automacao_id: int | None = None       # template salvo (kind=template_email)
    assunto: str | None = None            # ou assunto/corpo livres
    corpo: str | None = None
    html: bool = False
    cc: list[str] | None = None
    bcc: list[str] | None = None
    reply_to: str | None = None
    vars_extra: dict[str, str] | None = None    # variáveis extras pra render


class PreviewEmailIn(BaseModel):
    automacao_id: int | None = None
    assunto: str | None = None
    corpo: str | None = None
    vars_extra: dict[str, str] | None = None


@router.get("")
def list_contatos(
    db: DBSession,
    _: CurrentUser,
    q: str | None = None,
    empresa_id: int | None = None,
    cargo: str | None = None,             # busca substring case-insensitive
    decisor: bool | None = None,
    fonte: str | None = None,             # lusha / manual / cnpjws / linkedin
    has_email: bool | None = None,
    uf: str | None = None,                # filtra por UF da empresa
    sector: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
):
    """Lista global de contatos com filtros — para escolher por empresa+cargo."""
    from sqlalchemy import or_
    query = db.query(Contato).join(Empresa, Empresa.id == Contato.empresa_id, isouter=True)
    if not include_deleted:
        query = filter_active(query, Contato)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Contato.nome.ilike(like), Contato.email.ilike(like)))
    if empresa_id:
        query = query.filter(Contato.empresa_id == empresa_id)
    if cargo:
        query = query.filter(Contato.cargo.ilike(f"%{cargo}%"))
    if decisor is not None:
        query = query.filter(Contato.decisor == decisor)
    if fonte:
        query = query.filter(Contato.fonte == fonte)
    if has_email is True:
        query = query.filter(Contato.email.isnot(None), Contato.email != "")
    elif has_email is False:
        query = query.filter(or_(Contato.email.is_(None), Contato.email == ""))
    if uf:
        query = query.filter(Empresa.uf == uf.upper())
    if sector:
        query = query.filter(Empresa.sector == sector)

    total = query.with_entities(func.count(Contato.id)).scalar() or 0
    rows = (
        query.order_by(Contato.decisor.desc(), Contato.nome)
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    items = [
        {
            "id": c.id,
            "nome": c.nome,
            "cargo": c.cargo,
            "departamento": c.departamento,
            "email": c.email,
            "telefone": c.telefone,
            "celular": c.celular,
            "linkedin_url": c.linkedin_url,
            "decisor": c.decisor,
            "fonte": c.fonte,
            "empresa_id": c.empresa_id,
            "empresa": (
                {"id": c.empresa.id, "razao_social": c.empresa.razao_social,
                 "nome_fantasia": c.empresa.nome_fantasia, "uf": c.empresa.uf,
                 "sector": c.empresa.sector, "cnpj": c.empresa.cnpj}
                if c.empresa else None
            ),
            "created_at": c.created_at,
        }
        for c in rows
    ]
    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/cargos/distinct")
def cargos_distinct(db: DBSession, _: CurrentUser):
    """Lista de cargos distintos (pra autocomplete)."""
    rows = (
        db.query(Contato.cargo)
        .filter(Contato.cargo.isnot(None), Contato.cargo != "")
        .distinct()
        .order_by(Contato.cargo)
        .limit(500)
        .all()
    )
    return [r[0] for r in rows if r[0]]


@router.get("/{contato_id}", response_model=ContatoOut)
def get_contato(contato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    return c


@router.post("", response_model=ContatoOut, status_code=status.HTTP_201_CREATED)
def create_contato(payload: ContatoCreate, db: DBSession, current: CurrentUser):
    if not db.get(Empresa, payload.empresa_id):
        raise HTTPException(status_code=400, detail="Empresa inexistente")
    contato = Contato(**payload.model_dump(), created_by_id=current.id)
    if contato.owner_id is None:
        contato.owner_id = current.id
    db.add(contato)
    db.commit()
    db.refresh(contato)
    return contato


@router.patch("/{contato_id}", response_model=ContatoOut)
def update_contato(contato_id: int, payload: ContatoUpdate, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{contato_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contato(contato_id: int, db: DBSession, current: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    soft_delete(db, current.id, c)
    db.commit()


@router.post("/{contato_id}/restore", response_model=ContatoOut)
def restore_contato(contato_id: int, db: DBSession, _: CurrentUser):
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    restore(c)
    db.commit()
    db.refresh(c)
    return c


def _build_render_vars(c: Contato, empresa: Empresa | None, current, extra: dict | None) -> dict:
    return {
        "nome": (c.nome or "").split()[0] if c.nome else "",
        "nome_completo": c.nome or "",
        "cargo": c.cargo or "",
        "email": c.email or "",
        "empresa": (empresa.razao_social or empresa.nome_fantasia) if empresa else "",
        "remetente": getattr(current, "name", None) or current.email,
        "remetente_email": current.email,
        **(extra or {}),
    }


@router.post("/{contato_id}/preview-email")
def preview_email(contato_id: int, payload: PreviewEmailIn, db: DBSession, current: CurrentUser):
    """Renderiza assunto/corpo (substitui {{nome}}, {{empresa}}, ...) sem enviar."""
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")

    assunto = payload.assunto
    corpo = payload.corpo
    if payload.automacao_id:
        a = db.get(Automacao, payload.automacao_id)
        if not a or a.kind != AutomacaoKind.template_email:
            raise HTTPException(status_code=400, detail="Template de e-mail inválido")
        assunto = assunto or a.assunto
        corpo = corpo or a.corpo

    if not corpo:
        raise HTTPException(status_code=400, detail="Sem corpo de e-mail")

    empresa = db.get(Empresa, c.empresa_id) if c.empresa_id else None
    vars_ = _build_render_vars(c, empresa, current, payload.vars_extra)
    s, b = render_template(assunto or "", corpo, vars_)
    return {"para": c.email, "assunto": s, "corpo": b, "vars": vars_}


@router.post("/{contato_id}/enviar-email")
def enviar_email_contato(
    contato_id: int, payload: EnviarEmailIn, db: DBSession, current: CurrentUser
):
    """Envia e-mail para o contato via SMTP. Registra Atividade(tipo=email)."""
    c = db.get(Contato, contato_id)
    if not c:
        raise HTTPException(status_code=404, detail="Contato não encontrado")
    if not c.email:
        raise HTTPException(status_code=400, detail="Contato sem e-mail cadastrado")

    assunto = payload.assunto
    corpo = payload.corpo
    automacao = None
    if payload.automacao_id:
        automacao = db.get(Automacao, payload.automacao_id)
        if not automacao or automacao.kind != AutomacaoKind.template_email:
            raise HTTPException(status_code=400, detail="Template de e-mail inválido")
        assunto = assunto or automacao.assunto
        corpo = corpo or automacao.corpo

    if not corpo:
        raise HTTPException(status_code=400, detail="Sem corpo de e-mail")

    empresa = db.get(Empresa, c.empresa_id) if c.empresa_id else None
    vars_ = _build_render_vars(c, empresa, current, payload.vars_extra)
    assunto_r, corpo_r = render_template(assunto or "(sem assunto)", corpo, vars_)

    # Prioridade: Gmail do user (envio como ele, replies vão pra inbox dele) >
    # SMTP global (noreply@bradata)
    try:
        if current.google_refresh_token:
            result = gauth.send_via_gmail(
                db, current,
                c.email, assunto_r, corpo_r,
                cc=payload.cc, bcc=payload.bcc,
                html=payload.html, reply_to=payload.reply_to,
            )
        else:
            result = enviar_email(
                c.email, assunto_r, corpo_r,
                cc=payload.cc, bcc=payload.bcc,
                html=payload.html, reply_to=payload.reply_to,
            )
    except gauth.GoogleOAuthError as e:
        raise HTTPException(status_code=502, detail=f"Gmail: {e}")
    except SMTPError as e:
        raise HTTPException(status_code=502, detail=str(e))

    atv = Atividade(
        tipo=TipoAtividade.email,
        titulo=f"E-mail: {assunto_r[:200]}",
        descricao=corpo_r[:4000],
        status=AtividadeStatus.concluida,
        data_atividade=datetime.now(timezone.utc),
        empresa_id=c.empresa_id,
        contato_id=c.id,
        user_id=current.id,
        resultado=f"enviado via {result.get('via','smtp')} para {c.email}",
        direcao="enviado",
        gmail_thread_id=result.get("gmail_thread_id"),
        gmail_message_id=result.get("gmail_message_id"),
    )
    db.add(atv)

    if automacao:
        automacao.executada_n_vezes = (automacao.executada_n_vezes or 0) + 1
        automacao.ultima_execucao = datetime.now(timezone.utc)

    db.commit()
    return {"ok": True, "para": c.email, "assunto": assunto_r, **result, "atividade_id": atv.id}
