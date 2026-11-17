
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.dependencies import get_db
from backend.models.technology import Technology
from backend.schemas.technology import (
    TechnologyCreate,
    TechnologyResponse,
)

from backend.api.admin_auth import require_admin

router = APIRouter(
    prefix="/technologies",
    tags=["Technology Worlds"],
)

DbSession = Annotated[Session, Depends(get_db)]


@router.post(
    "/",
    response_model=TechnologyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_technology(payload: TechnologyCreate, db: DbSession):
    technology = Technology(**payload.model_dump())

    db.add(technology)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A technology with this name or slug already exists",
        )

    db.refresh(technology)
    return technology


@router.get(
    "/",
    response_model=list[TechnologyResponse],
)
def list_technologies(db: DbSession):
    statement = select(Technology).order_by(Technology.name)
    return db.scalars(statement).all()


@router.get(
    "/{technology_id}",
    response_model=TechnologyResponse,
)
def get_technology(technology_id: int, db: DbSession):
    technology = db.get(Technology, technology_id)

    if technology is None:
        raise HTTPException(
            status_code=404,
            detail="Technology not found",
        )

    return technology
