from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, or_

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.core.database import SessionLocal
from app.models.atividade import Atividade
from app.models.contato import Contato
from app.models.empresa import Empresa, EmpresaStatus
from app.models.nota import Nota
from app.models.pncp import PncpResultado
from app.schemas.atividade import AtividadeOut
from app.schemas.common import Page
from app.schemas.empresa import EmpresaCreate, EmpresaOut, EmpresaUpdate
from app.schemas.nota import NotaOut
from app.services.cnpj_ws import enrich_empresa_from_cnpjws
from app.services.empresa_service import classify_icp
from app.services.historico import log_event
from app.services.lusha import enriquecer_empresa as lusha_enriquecer, LushaError
from app.services.soft_delete import soft_delete, restore, filter_active

router = APIRouter()


def _classificacao_por_valor(valor_total: float, ticket_medio: float | None) -> str:
    """alto/medio/baixo baseado em valor total de contratos PNCP ganhos."""
    v = float(valor_total or 0)
    if v >= 10_000_000 or (ticket_medio and ticket_medio >= 1_000_000):
        return "alto"
    if v >= 1_000_000 or (ticket_medio and ticket_medio >= 200_000):
        return "medio"
    return "baixo"


def _faixa_faturamento(faturamento: float | None) -> str | None:
    if faturamento is None:
        return None
    if faturamento <= 81_000:
        return "Até R$ 81 mil"
    if faturamento <= 360_000:
        return "R$ 81 mil - R$ 360 mil"
    if faturamento <= 4_800_000:
        return "R$ 360 mil - R$ 4,8 milhões"
    if faturamento <= 300_000_000:
        return "R$ 4,8 milhões - R$ 300 milhões"
    return "Acima de R$ 300 milhões"


def _serialize(db, empresa: Empresa) -> EmpresaOut:
    contatos_n = (
        db.query(func.count(Contato.id)).filter(Contato.empresa_id == empresa.id).scalar() or 0
    )
    contracts_pncp, valor_total = (
        db.query(
            func.count(PncpResultado.id),
            func.coalesce(func.sum(PncpResultado.valor_total_homologado), 0),
        )
        .filter(PncpResultado.empresa_id == empresa.id)
        .first()
    ) or (0, 0)
    out = EmpresaOut.model_validate(empresa)
    out.contatos_n = int(contatos_n)
    out.contracts_pncp = int(contracts_pncp or 0)
    out.valor_total_contratos = float(valor_total or 0)
    out.classificacao_valor = _classificacao_por_valor(valor_total, empresa.ticket_medio)
    out.faixa_faturamento = _faixa_faturamento(empresa.faturamento_estimado)
    return out


@router.get("/setores")
def list_setores(db: DBSession, _: CurrentUser):
    """Lista setores distintos das empresas para filtros de UI."""
    rows = (
        db.query(Empresa.sector)
        .filter(Empresa.sector.isnot(None))
        .distinct()
        .order_by(Empresa.sector)
        .all()
    )
    setores = [r[0] for r in rows if r[0]]
    return {"setores": setores}


@router.get("", response_model=Page[EmpresaOut])
def list_empresas(
    db: DBSession,
    _: CurrentUser,
    q: str | None = None,
    uf: str | None = None,
    municipio: str | None = None,
    is_icp: bool | None = None,
    owner_id: int | None = None,
    origem: str | None = None,
    status_: EmpresaStatus | None = Query(None, alias="status"),
    faturamento_min: float | None = None,
    cnae: str | None = None,
    sector: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    include_deleted: bool = False,
):
    query = db.query(Empresa)
    if not include_deleted:
        query = filter_active(query, Empresa)
    filters = []
    if q:
        like = f"%{q}%"
        filters.append(
            or_(Empresa.razao_social.ilike(like), Empresa.nome_fantasia.ilike(like), Empresa.cnpj.ilike(like))
        )
    if uf:
        filters.append(Empresa.uf == uf.upper())
    if municipio:
        filters.append(Empresa.municipio.ilike(f"%{municipio}%"))
    if is_icp is not None:
        filters.append(Empresa.is_icp == is_icp)
    if owner_id:
        filters.append(Empresa.owner_id == owner_id)
    if origem:
        filters.append(Empresa.origem == origem)
    if status_:
        filters.append(Empresa.status == status_)
    if faturamento_min is not None:
        filters.append(Empresa.faturamento_estimado >= faturamento_min)
    if cnae:
        filters.append(Empresa.cnae_principal == cnae)
    if sector:
        filters.append(Empresa.sector == sector)
    if filters:
        query = query.filter(and_(*filters))

    total = query.with_entities(func.count(Empresa.id)).scalar() or 0
    items = query.order_by(Empresa.razao_social).offset((page - 1) * size).limit(size).all()
    return Page[EmpresaOut](items=[_serialize(db, e) for e in items], total=total, page=page, size=size)


@router.get("/{empresa_id}", response_model=EmpresaOut)
def get_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return _serialize(db, empresa)


@router.post("", response_model=EmpresaOut, status_code=status.HTTP_201_CREATED)
def create_empresa(payload: EmpresaCreate, db: DBSession, current: CurrentUser):
    existing = db.query(Empresa).filter(Empresa.cnpj == payload.cnpj).first()
    if existing:
        raise HTTPException(status_code=400, detail="Empresa com este CNPJ já cadastrada")
    empresa = Empresa(**payload.model_dump(), created_by_id=current.id)
    if empresa.owner_id is None:
        empresa.owner_id = current.id
    classify_icp(empresa)
    db.add(empresa)
    db.commit()
    db.refresh(empresa)
    return _serialize(db, empresa)


@router.patch("/{empresa_id}", response_model=EmpresaOut)
def update_empresa(empresa_id: int, payload: EmpresaUpdate, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(empresa, k, v)
    classify_icp(empresa)
    db.commit()
    db.refresh(empresa)
    return _serialize(db, empresa)


@router.delete("/{empresa_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_empresa(empresa_id: int, db: DBSession, current: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    log_event(db, current.id, "empresa", empresa.id, "excluiu", {"razao_social": empresa.razao_social, "cnpj": empresa.cnpj})
    soft_delete(db, current.id, empresa)
    db.commit()


@router.post("/{empresa_id}/restore", response_model=EmpresaOut)
def restore_empresa(empresa_id: int, db: DBSession, current: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    restore(empresa)
    log_event(db, current.id, "empresa", empresa.id, "restaurou", None)
    db.commit()
    db.refresh(empresa)
    return _serialize(db, empresa)


@router.post("/{empresa_id}/enriquecer", response_model=EmpresaOut)
def enriquecer_empresa(empresa_id: int, db: DBSession, current: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    ok = enrich_empresa_from_cnpjws(empresa)
    classify_icp(empresa)
    log_event(db, current.id, "empresa", empresa.id, "enriqueceu_cnpjws",
              {"sucesso": bool(ok), "website_obtido": empresa.website})
    db.commit()
    db.refresh(empresa)
    return _serialize(db, empresa)


def _enriquecer_pendentes_job(limit: int) -> None:
    """Roda CNPJ.WS em background para empresas sem website."""
    import logging
    from app.core.config import settings as _settings
    log = logging.getLogger("empresas.enriquecer-pendentes")
    with SessionLocal() as db:
        pendentes = (
            db.query(Empresa)
            .filter(Empresa.website.is_(None))
            .limit(limit)
            .all()
        )
        log.info(
            "Enriquecendo %s empresas pendentes via CNPJ.WS (%s)",
            len(pendentes),
            "comercial/token" if _settings.cnpj_ws_token else "público",
        )
        ok = err = 0
        for e in pendentes:
            try:
                if enrich_empresa_from_cnpjws(e):
                    classify_icp(e)
                    db.commit()
                    ok += 1
            except Exception as ex:
                log.warning("Falha empresa %s: %s", e.id, ex)
                db.rollback()
                err += 1
        log.info("Enriquecimento concluído: %s ok, %s erros", ok, err)


@router.post("/enriquecer-pendentes")
def enriquecer_pendentes(
    bg: BackgroundTasks,
    _: AdminUser,
    limit: int = Query(500, ge=1, le=5000),
):
    """Enriquece em background todas as empresas com website=NULL via CNPJ.WS.

    Respeita rate-limit (~2 req/s). Para 100 empresas leva ~50s.
    """
    bg.add_task(_enriquecer_pendentes_job, limit)
    return {"message": f"Enriquecimento de até {limit} empresas pendentes agendado", "limit": limit}


@router.post("/{empresa_id}/enriquecer-lusha")
def enriquecer_lusha(empresa_id: int, db: DBSession, current: CurrentUser):
    """[Compat] Busca candidates Lusha (não revela). Use /lusha/candidates/{id}/revelar pra revelar."""
    from app.services.lusha import buscar_candidates_empresa
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    try:
        resumo = buscar_candidates_empresa(db, empresa)
    except LushaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    log_event(db, current.id, "empresa", empresa.id, "lusha_busca",
              {"novos": resumo.get("novos", 0), "atualizados": resumo.get("atualizados", 0),
               "dominio": resumo.get("dominio"), "total": resumo.get("total", 0)})
    db.commit()
    return resumo


@router.post("/{empresa_id}/lusha/search")
def lusha_search(empresa_id: int, db: DBSession, current: CurrentUser):
    """Busca contatos Lusha pra o componente LushaEnrichButton (frontend novo).
    Retorna {requestId, contacts: [{contactId, fullName, jobTitle, hasPhones,
    hasWorkEmail, isShown, ...}]}. NÃO consome crédito de reveal.
    """
    from app.services.lusha import search_for_frontend
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    try:
        result = search_for_frontend(db, empresa)
    except LushaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    log_event(db, current.id, "empresa", empresa_id, "lusha_search_v2",
              {"total": len(result.get("contacts", [])), "domain": result.get("domain")})
    db.commit()
    return result


class LushaEnrichBatchIn(BaseModel):
    request_id: str | None = None
    contact_ids: list[str] = []     # lusha_person_ids selecionados pelo user


@router.post("/{empresa_id}/lusha/enrich-batch")
def lusha_enrich_batch(
    empresa_id: int, payload: LushaEnrichBatchIn, db: DBSession, current: CurrentUser
):
    """Revela em lote os contacts selecionados — CONSOME 1 CRÉDITO POR contact.
    Retorna lista de Contatos criados/atualizados.
    """
    from app.models.lusha_candidate import LushaCandidate
    from app.services.lusha import revelar_candidate
    if not db.get(Empresa, empresa_id):
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    if not payload.contact_ids:
        return {"revealed": [], "errors": []}

    candidates = (
        db.query(LushaCandidate)
        .filter(
            LushaCandidate.empresa_id == empresa_id,
            LushaCandidate.lusha_person_id.in_(payload.contact_ids),
        )
        .all()
    )
    revealed = []
    errors = []
    for cand in candidates:
        try:
            contato = revelar_candidate(db, cand, current.id)
            revealed.append({
                "id": contato.id, "nome": contato.nome, "cargo": contato.cargo,
                "email": contato.email, "telefone": contato.telefone, "celular": contato.celular,
                "linkedin_url": contato.linkedin_url,
            })
        except LushaError as e:
            errors.append({"contactId": cand.lusha_person_id, "error": str(e)})
            if "créditos" in str(e).lower():
                break  # para imediatamente

    log_event(db, current.id, "empresa", empresa_id, "lusha_enrich_batch",
              {"revealed": len(revealed), "errors": len(errors)})
    return {"revealed": revealed, "errors": errors}


@router.get("/{empresa_id}/full")
def empresa_full(empresa_id: int, db: DBSession, _: CurrentUser):
    """Retorna empresa + KPIs + contratos PNCP + sócios + agregados pra a tela
    de Fornecedor Detalhe. Compatível com o shape esperado pelo `useFornecedor`
    + `useFornecedorCRM` do frontend novo.
    """
    from app.models.contato import Contato
    from app.models.lusha_candidate import LushaCandidate
    from app.models.pncp import PncpContrato, PncpResultado
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    # Contratos PNCP via PncpResultado (fornecedor que ganhou) → join com PncpContrato
    resultados = (
        db.query(PncpResultado)
        .filter(PncpResultado.empresa_id == empresa_id)
        .order_by(PncpResultado.data_resultado.desc().nullslast())
        .all()
    )
    contratos = []
    for r in resultados:
        contratos.append({
            "id": r.id,
            "title": r.numero_controle_pncp_compra,
            "orgao_nome": r.orgao_razao_social,
            "data_inicio_vigencia": r.data_resultado.isoformat() if r.data_resultado else None,
            "data_fim_vigencia": None,  # sem dado direto
            "valor_global": float(r.valor_total_homologado or 0),
            "uf": r.unidade_orgao_uf_sigla,
            "classificacao_ia": getattr(r, "classificacao_bodyshop", None),
            "tipo_servico_identificado": getattr(r, "tipo_servico_ia", None),
            "modalidade_licitacao_nome": r.modalidade_nome,
            "esfera_nome": r.esfera_nome,
            "ano": (r.data_resultado.year if r.data_resultado else None),
            "url_contrato": None,
        })

    total_contratos = len(contratos)
    valor_total = sum(c["valor_global"] for c in contratos)
    primeiro = min((c["data_inicio_vigencia"] for c in contratos if c["data_inicio_vigencia"]), default=None)
    ultimo = max((c["data_inicio_vigencia"] for c in contratos if c["data_inicio_vigencia"]), default=None)

    # Contatos
    contatos_count = (
        db.query(func.count(Contato.id))
        .filter(Contato.empresa_id == empresa_id, Contato.deleted_at.is_(None))
        .scalar() or 0
    )
    lusha_total = (
        db.query(func.count(LushaCandidate.id))
        .filter(LushaCandidate.empresa_id == empresa_id)
        .scalar() or 0
    )
    lusha_revelados = (
        db.query(func.count(LushaCandidate.id))
        .filter(LushaCandidate.empresa_id == empresa_id, LushaCandidate.revelado_em.isnot(None))
        .scalar() or 0
    )

    # Endereço completo
    endereco_parts = [empresa.logradouro, empresa.numero, empresa.complemento, empresa.bairro,
                     empresa.municipio, empresa.uf, empresa.cep]
    endereco = ", ".join(p for p in endereco_parts if p)

    return {
        "id": empresa.id,
        "cnpj": empresa.cnpj,
        "nome": empresa.razao_social or empresa.nome_fantasia or empresa.cnpj,
        "razao_social": empresa.razao_social,
        "nome_fantasia": empresa.nome_fantasia,
        "telefone": empresa.telefone,
        "email": empresa.email,
        "website": empresa.website,
        "linkedin": empresa.linkedin_url,
        "endereco": endereco,
        "cidade": empresa.municipio,
        "estado": empresa.uf,
        "cep": empresa.cep,
        # Enriquecimento CNPJ.WS
        "dados_enriquecidos": empresa.enriquecida_em is not None,
        "data_enriquecimento": empresa.enriquecida_em.isoformat() if empresa.enriquecida_em else None,
        "porte": empresa.porte,
        "natureza_juridica": empresa.natureza_juridica,
        "situacao_cadastral": empresa.situacao_cadastral,
        "regime_tributario": empresa.regime_tributario,
        "capital_social": empresa.capital_social,
        "data_abertura": empresa.data_abertura.isoformat() if empresa.data_abertura else None,
        "atividade_principal_codigo": empresa.cnae_principal,
        "atividade_principal": empresa.cnae_principal_descricao,
        "atividades_secundarias": empresa.cnaes_secundarios or [],
        "setor": empresa.sector,
        "nicho": empresa.cnae_principal_descricao,
        "faixa_faturamento": _faixa_faturamento(empresa.faturamento_estimado),
        "socios": empresa.socios or [],
        # Stats de contratos
        "totalContratos": total_contratos,
        "valorTotal": valor_total,
        "primeiroContrato": primeiro,
        "ultimoContrato": ultimo,
        "contratos": contratos,
        # Outros
        "contatos_count": contatos_count,
        "lusha_total": lusha_total,
        "lusha_revelados": lusha_revelados,
        "is_icp": empresa.is_icp,
        "icp_score": empresa.icp_score,
        "icp_motivo": empresa.icp_motivo,
        "status": empresa.status.value,
    }


@router.get("/{empresa_id}/lusha/candidates")
def listar_candidates_lusha(empresa_id: int, db: DBSession, _: CurrentUser):
    """Lista candidates Lusha da empresa (sem dados revelados)."""
    from app.models.lusha_candidate import LushaCandidate
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    rows = (
        db.query(LushaCandidate)
        .filter(LushaCandidate.empresa_id == empresa_id)
        .order_by(LushaCandidate.revelado_em.desc().nullslast(), LushaCandidate.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "lusha_person_id": c.lusha_person_id,
            "nome": c.nome,
            "cargo": c.cargo,
            "departamento": c.departamento,
            "linkedin_url": c.linkedin_url,
            "has_email": c.has_email, "has_phone": c.has_phone, "has_mobile": c.has_mobile,
            "n_emails": c.n_emails, "n_phones": c.n_phones,
            "revelado_em": c.revelado_em,
            "contato_id": c.contato_id,
            "created_at": c.created_at,
        }
        for c in rows
    ]


@router.post("/lusha/candidates/{cand_id}/revelar")
def revelar_lusha(cand_id: int, db: DBSession, current: CurrentUser):
    """Revela um candidate Lusha — CONSOME 1 CRÉDITO. Cria Contato real."""
    from app.models.lusha_candidate import LushaCandidate
    from app.services.lusha import revelar_candidate
    c = db.get(LushaCandidate, cand_id)
    if not c:
        raise HTTPException(status_code=404, detail="Candidate não encontrado")
    try:
        contato = revelar_candidate(db, c, current.id)
    except LushaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    log_event(db, current.id, "empresa", c.empresa_id, "lusha_revelou",
              {"candidate_id": c.id, "contato_id": contato.id})
    db.commit()
    return {
        "id": contato.id,
        "nome": contato.nome,
        "cargo": contato.cargo,
        "email": contato.email,
        "telefone": contato.telefone,
        "celular": contato.celular,
        "linkedin_url": contato.linkedin_url,
        "lusha_person_id": contato.lusha_person_id,
    }


@router.get("/{empresa_id}/diag")
def diagnostico_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    """Diagnóstico das integrações para uma empresa: o que CNPJ.WS e Lusha veem."""
    from app.core.config import settings as _settings
    from app.services.cnpj_ws import _fetch as cnpj_fetch, CnpjWsError
    from app.services.lusha import _domain_of

    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")

    diag = {
        "empresa": {
            "id": empresa.id, "cnpj": empresa.cnpj,
            "razao_social": empresa.razao_social,
            "website": empresa.website, "email": empresa.email,
            "enriquecida_em": empresa.enriquecida_em,
        },
        "cnpj_ws": {
            "endpoint_em_uso": "comercial.cnpj.ws (token)" if _settings.cnpj_ws_token else "publica.cnpj.ws (sem token)",
            "delay_ms": 200 if _settings.cnpj_ws_token else _settings.cnpj_ws_request_delay_ms,
        },
        "lusha": {
            "configurada": bool(_settings.lusha_api_key),
            "dominio_derivado": _domain_of(empresa),
            "max_contatos": _settings.lusha_max_contatos_por_empresa,
            "cargos": _settings.lusha_cargos_prioridade_list[:5],
        },
    }
    # Ping rápido CNPJ.WS sem aplicar mudanças
    try:
        raw = cnpj_fetch(empresa.cnpj) if empresa.cnpj else None
        diag["cnpj_ws"]["status"] = "ok" if raw else "404 (CNPJ não encontrado)"
        if raw:
            estab = raw.get("estabelecimento") or {}
            diag["cnpj_ws"]["sample"] = {
                "razao_social": raw.get("razao_social"),
                "nome_fantasia": estab.get("nome_fantasia"),
                "email": estab.get("email"),
                "porte": (raw.get("porte") or {}).get("descricao"),
            }
    except CnpjWsError as e:
        diag["cnpj_ws"]["status"] = f"erro: {e}"
    except Exception as e:
        diag["cnpj_ws"]["status"] = f"falha inesperada: {e}"

    return diag


@router.get("/{empresa_id}/contatos")
def listar_contatos_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    from app.models.contato import Contato  # local para evitar circular
    if not db.get(Empresa, empresa_id):
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    contatos = (
        db.query(Contato)
        .filter(Contato.empresa_id == empresa_id)
        .order_by(Contato.principal.desc(), Contato.decisor.desc(), Contato.nome)
        .all()
    )
    return [
        {
            "id": c.id,
            "nome": c.nome,
            "cargo": c.cargo,
            "email": c.email,
            "telefone": c.telefone,
            "celular": c.celular,
            "linkedin_url": c.linkedin_url,
            "decisor": c.decisor,
            "fonte": c.fonte,
            "created_at": c.created_at,
        }
        for c in contatos
    ]


@router.get("/{empresa_id}/timeline")
def empresa_timeline(empresa_id: int, db: DBSession, _: CurrentUser, limit: int = 50):
    from app.models.historico import Historico
    from app.models.oportunidade import Oportunidade
    from app.models.user import User as _User

    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    atividades = (
        db.query(Atividade)
        .filter(Atividade.empresa_id == empresa_id)
        .order_by(Atividade.data_atividade.desc().nullslast(), Atividade.created_at.desc())
        .limit(limit)
        .all()
    )
    notas = (
        db.query(Nota)
        .filter(Nota.empresa_id == empresa_id)
        .order_by(Nota.created_at.desc())
        .limit(limit)
        .all()
    )
    # Histórico das oportunidades dessa empresa
    op_ids = [r[0] for r in db.query(Oportunidade.id).filter(Oportunidade.empresa_id == empresa_id).all()]
    historico_rows = []
    if op_ids:
        historico_rows = (
            db.query(Historico)
            .filter(Historico.entity_type == "oportunidade", Historico.entity_id.in_(op_ids))
            .order_by(Historico.created_at.desc())
            .limit(limit)
            .all()
        )
    user_ids = {h.user_id for h in historico_rows if h.user_id}
    users = {u.id: u for u in db.query(_User).filter(_User.id.in_(user_ids)).all()} if user_ids else {}

    items = []
    for a in atividades:
        items.append({"kind": "atividade", "id": a.id, "data": AtividadeOut.model_validate(a).model_dump(), "ts": a.data_atividade or a.created_at})
    for n in notas:
        items.append({"kind": "nota", "id": n.id, "data": NotaOut.model_validate(n).model_dump(), "ts": n.created_at})
    for h in historico_rows:
        items.append({
            "kind": "historico",
            "id": h.id,
            "data": {
                "entity_type": h.entity_type,
                "entity_id": h.entity_id,
                "acao": h.acao,
                "changes": h.changes,
                "user_nome": users.get(h.user_id).nome if h.user_id and users.get(h.user_id) else None,
            },
            "ts": h.created_at,
        })
    items.sort(key=lambda x: x["ts"], reverse=True)
    return items[:limit]


@router.get("/{empresa_id}/pncp")
def empresa_pncp_history(empresa_id: int, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    rows = (
        db.query(PncpResultado)
        .filter(PncpResultado.empresa_id == empresa_id)
        .order_by(PncpResultado.data_resultado.desc().nullslast())
        .limit(200)
        .all()
    )
    return [
        {
            "id": r.id,
            "numero_controle_pncp_compra": r.numero_controle_pncp_compra,
            "fornecedor": r.nome_razao_social_fornecedor,
            "valor_total_homologado": r.valor_total_homologado,
            "data_resultado": r.data_resultado,
            "situacao": r.situacao_nome,
        }
        for r in rows
    ]
