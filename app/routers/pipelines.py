from fastapi import APIRouter, HTTPException, status

from app.core.deps import AdminUser, CurrentUser, DBSession
from app.models.oportunidade import Pipeline, PipelineEstagio
from app.schemas.oportunidade import PipelineCreate, PipelineOut

router = APIRouter()


@router.get("", response_model=list[PipelineOut])
def list_pipelines(db: DBSession, _: CurrentUser):
    return db.query(Pipeline).order_by(Pipeline.nome).all()


@router.post("", response_model=PipelineOut, status_code=status.HTTP_201_CREATED)
def create_pipeline(payload: PipelineCreate, db: DBSession, _: AdminUser):
    if db.query(Pipeline).filter(Pipeline.nome == payload.nome).first():
        raise HTTPException(status_code=400, detail="Pipeline com este nome já existe")
    pipeline = Pipeline(nome=payload.nome, descricao=payload.descricao, ativo=payload.ativo)
    for e in payload.estagios:
        pipeline.estagios.append(PipelineEstagio(**e.model_dump()))
    db.add(pipeline)
    db.commit()
    db.refresh(pipeline)
    return pipeline


@router.get("/{pipeline_id}", response_model=PipelineOut)
def get_pipeline(pipeline_id: int, db: DBSession, _: CurrentUser):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline não encontrado")
    return pipeline


@router.delete("/{pipeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pipeline(pipeline_id: int, db: DBSession, _: AdminUser):
    pipeline = db.get(Pipeline, pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline não encontrado")
    db.delete(pipeline)
    db.commit()
