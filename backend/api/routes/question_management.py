
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.api.admin_auth import require_admin
from backend.api.dependencies import get_db
from backend.models.question import Question
from backend.models.technology import Technology
from backend.schemas.question import (
    QuestionResponse,
    QuestionUpdate,
    Zone,
)
from backend.services.import_service import (
    normalize_question,
    question_fingerprint,
)


router = APIRouter(
    prefix="/admin/questions",
    tags=["Admin Question Management"],
    dependencies=[Depends(require_admin)],
)

DbSession = Annotated[Session, Depends(get_db)]


class QuestionListResponse(BaseModel):
    total: int
    questions: list[QuestionResponse]


class ZoneCount(BaseModel):
    zone: Zone
    count: int
    playable_count: int


def playable_conditions():
    return (
        Question.option_a.is_not(None),
        Question.option_b.is_not(None),
        Question.option_c.is_not(None),
        Question.option_d.is_not(None),
        Question.correct_answer.in_(("A", "B", "C", "D")),
        Question.explanation.is_not(None),
        func.length(func.trim(Question.option_a)) > 0,
        func.length(func.trim(Question.option_b)) > 0,
        func.length(func.trim(Question.option_c)) > 0,
        func.length(func.trim(Question.option_d)) > 0,
        func.length(func.trim(Question.explanation)) > 0,
    )


@router.get(
    "/counts/{technology_id}",
    response_model=list[ZoneCount],
)
def get_question_counts(
    technology_id: int,
    db: DbSession,
):
    if db.get(Technology, technology_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Technology not found",
        )

    result = []

    for zone in ("basics", "interview", "coding"):
        total = db.scalar(
            select(func.count(Question.id)).where(
                Question.technology_id == technology_id,
                Question.zone == zone,
            )
        ) or 0

        playable = db.scalar(
            select(func.count(Question.id)).where(
                Question.technology_id == technology_id,
                Question.zone == zone,
                *playable_conditions(),
            )
        ) or 0

        result.append(
            ZoneCount(
                zone=zone,
                count=total,
                playable_count=playable,
            )
        )

    return result


@router.get(
    "/",
    response_model=QuestionListResponse,
)
def list_questions(
    db: DbSession,
    technology_id: int = Query(gt=0),
    zone: Zone = "basics",
    search: str = Query(default="", max_length=200),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    if db.get(Technology, technology_id) is None:
        raise HTTPException(
            status_code=404,
            detail="Technology not found",
        )

    filters = [
        Question.technology_id == technology_id,
        Question.zone == zone,
    ]

    if search.strip():
        term = f"%{search.strip()}%"

        filters.append(
            or_(
                Question.question_text.ilike(term),
                Question.explanation.ilike(term),
                Question.answer_text.ilike(term),
            )
        )

    total = db.scalar(
        select(func.count(Question.id)).where(*filters)
    ) or 0

    statement = (
        select(Question)
        .where(*filters)
        .order_by(Question.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    questions = db.scalars(statement).all()

    return QuestionListResponse(
        total=total,
        questions=questions,
    )


@router.patch(
    "/{question_id}",
    response_model=QuestionResponse,
)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    db: DbSession,
):
    question = db.get(Question, question_id)

    if question is None:
        raise HTTPException(
            status_code=404,
            detail="Question not found",
        )

    option_values = (
        payload.option_a,
        payload.option_b,
        payload.option_c,
        payload.option_d,
    )

    if len({
        normalize_question(value)
        for value in option_values
    }) != 4:
        raise HTTPException(
            status_code=422,
            detail="All four options must be different",
        )

    new_fingerprint = question_fingerprint(
        payload.question_text
    )

    duplicate = db.scalar(
        select(Question.id).where(
            Question.technology_id == question.technology_id,
            Question.zone == question.zone,
            Question.fingerprint == new_fingerprint,
            Question.id != question.id,
        )
    )

    if duplicate is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "This question already exists "
                "in this technology and zone"
            ),
        )

    question.question_text = payload.question_text

    question.option_a = payload.option_a
    question.option_b = payload.option_b
    question.option_c = payload.option_c
    question.option_d = payload.option_d

    question.correct_answer = payload.correct_answer
    question.explanation = payload.explanation

    question.fingerprint = new_fingerprint

    # Once converted, the MCQ fields replace
    # the old flashcard answer.
    question.answer_text = None

    try:
        db.commit()
        db.refresh(question)

    except IntegrityError as exc:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "This question already exists "
                "in this technology and zone"
            ),
        ) from exc

    except Exception:
        db.rollback()
        raise

    return question


@router.delete(
    "/{question_id}",
    status_code=204,
)
def delete_question(
    question_id: int,
    db: DbSession,
):
    question = db.get(Question, question_id)

    if question is None:
        raise HTTPException(
            status_code=404,
            detail="Question not found",
        )

    try:
        db.delete(question)
        db.commit()
    except Exception:
        db.rollback()
        raise
