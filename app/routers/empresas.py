from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, func, or_

from app.core.deps import CurrentUser, DBSession
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
from app.services.lusha import enriquecer_empresa as lusha_enriquecer, LushaError

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
):
    query = db.query(Empresa)
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
def delete_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    db.delete(empresa)
    db.commit()


@router.post("/{empresa_id}/enriquecer", response_model=EmpresaOut)
def enriquecer_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    enrich_empresa_from_cnpjws(empresa)
    classify_icp(empresa)
    db.commit()
    db.refresh(empresa)
    return _serialize(db, empresa)


@router.post("/{empresa_id}/enriquecer-lusha")
def enriquecer_lusha(empresa_id: int, db: DBSession, _: CurrentUser):
    """Busca decisores (CTO, Head de TI, etc.) via Lusha. Cache permanente."""
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    try:
        resumo = lusha_enriquecer(db, empresa)
    except LushaError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return resumo


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
    items = []
    for a in atividades:
        items.append({"kind": "atividade", "id": a.id, "data": AtividadeOut.model_validate(a).model_dump(), "ts": a.data_atividade or a.created_at})
    for n in notas:
        items.append({"kind": "nota", "id": n.id, "data": NotaOut.model_validate(n).model_dump(), "ts": n.created_at})
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
