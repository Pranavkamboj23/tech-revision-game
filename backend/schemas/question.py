
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


Zone = Literal["basics", "interview", "coding"]
AnswerOption = Literal["A", "B", "C", "D"]


class MCQFields(BaseModel):
    question_text: str = Field(min_length=1)
    option_a: str = Field(min_length=1)
    option_b: str = Field(min_length=1)
    option_c: str = Field(min_length=1)
    option_d: str = Field(min_length=1)
    correct_answer: AnswerOption
    explanation: str = Field(min_length=1)

    @field_validator(
        "question_text",
        "option_a",
        "option_b",
        "option_c",
        "option_d",
        "explanation",
    )
    @classmethod
    def validate_non_empty(cls, value: str) -> str:
        cleaned = value.strip()

        if not cleaned:
            raise ValueError("Field cannot be empty")

        return cleaned

    @field_validator("correct_answer", mode="before")
    @classmethod
    def normalize_correct_answer(cls, value):
        if isinstance(value, str):
            return value.strip().upper()

        return value


class QuestionUpdate(MCQFields):
    pass


class QuestionResponse(BaseModel):
    id: int
    technology_id: int
    zone: Zone

    question_text: str

    option_a: str | None
    option_b: str | None
    option_c: str | None
    option_d: str | None

    correct_answer: AnswerOption | None
    explanation: str | None

    # Only old flashcards have this populated.
    answer_text: str | None

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicQuestionResponse(BaseModel):
    id: int
    technology_id: int
    zone: Zone

    question_text: str

    option_a: str
    option_b: str
    option_c: str
    option_d: str

    # Do not expose correct_answer or explanation
    # until the player submits a choice.

    model_config = ConfigDict(from_attributes=True)


class AnswerSubmission(BaseModel):
    selected_answer: AnswerOption

    @field_validator("selected_answer", mode="before")
    @classmethod
    def normalize_answer(cls, value):
        if isinstance(value, str):
            return value.strip().upper()

        return value


class AnswerResult(BaseModel):
    question_id: int
    selected_answer: AnswerOption
    correct_answer: AnswerOption
    is_correct: bool
    explanation: str


class ImportResponse(BaseModel):
    technology: str
    zone: Zone
    added: int
    skipped_duplicates: int
