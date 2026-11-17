
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.api.dependencies import get_db
from backend.models.question import Question
from backend.models.technology import Technology
from backend.schemas.question import (
    AnswerResult,
    AnswerSubmission,
    PublicQuestionResponse,
    Zone,
)


router = APIRouter(
    prefix="/questions",
    tags=["Questions"],
)

DbSession = Annotated[Session, Depends(get_db)]


def is_playable(question: Question) -> bool:
    fields = (
        question.option_a,
        question.option_b,
        question.option_c,
        question.option_d,
        question.explanation,
    )

    return (
        all(
            isinstance(value, str) and value.strip()
            for value in fields
        )
        and question.correct_answer in ("A", "B", "C", "D")
        and len({
            " ".join(value.casefold().split())
            for value in (
                question.option_a,
                question.option_b,
                question.option_c,
                question.option_d,
            )
        }) == 4
    )


@router.get(
    "/technologies/{technology_id}/{zone}",
    response_model=list[PublicQuestionResponse],
)
def get_random_questions(
    technology_id: int,
    zone: Zone,
    db: DbSession,
    limit: int = Query(default=10, ge=1, le=50),
):
    technology = db.get(Technology, technology_id)

    if technology is None:
        raise HTTPException(
            status_code=404,
            detail="Technology not found",
        )

    statement = (
        select(Question)
        .where(
            Question.technology_id == technology_id,
            Question.zone == zone,
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
        .order_by(func.random())
        .limit(limit)
    )

    questions = db.scalars(statement).all()

    return [
        question
        for question in questions
        if is_playable(question)
    ]


@router.post(
    "/{question_id}/answer",
    response_model=AnswerResult,
)
def check_answer(
    question_id: int,
    payload: AnswerSubmission,
    db: DbSession,
):
    question = db.get(Question, question_id)

    if question is None or not is_playable(question):
        raise HTTPException(
            status_code=404,
            detail="Playable question not found",
        )

    selected = payload.selected_answer
    correct = question.correct_answer

    return AnswerResult(
        question_id=question.id,
        selected_answer=selected,
        correct_answer=correct,
        is_correct=(selected == correct),
        explanation=question.explanation,
    )
