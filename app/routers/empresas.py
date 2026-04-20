from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, func, or_

from app.core.deps import CurrentUser, DBSession
from app.models.empresa import Empresa
from app.schemas.common import Page
from app.schemas.empresa import EmpresaCreate, EmpresaOut, EmpresaUpdate
from app.services.empresa_service import classify_icp
from app.services.cnpj_ws import enrich_empresa_from_cnpjws

router = APIRouter()


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
    faturamento_min: float | None = None,
    cnae: str | None = None,
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
    if faturamento_min is not None:
        filters.append(Empresa.faturamento_estimado >= faturamento_min)
    if cnae:
        filters.append(Empresa.cnae_principal == cnae)
    if filters:
        query = query.filter(and_(*filters))

    total = query.with_entities(func.count(Empresa.id)).scalar() or 0
    items = query.order_by(Empresa.razao_social).offset((page - 1) * size).limit(size).all()
    return Page[EmpresaOut](items=items, total=total, page=page, size=size)


@router.get("/{empresa_id}", response_model=EmpresaOut)
def get_empresa(empresa_id: int, db: DBSession, _: CurrentUser):
    empresa = db.get(Empresa, empresa_id)
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    return empresa


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
    return empresa


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
    return empresa


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
    return empresa
