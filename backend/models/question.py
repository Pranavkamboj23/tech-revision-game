
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.base import Base


class Question(Base):
    __tablename__ = "questions"

    __table_args__ = (
        UniqueConstraint(
            "technology_id",
            "zone",
            "fingerprint",
            name="uq_question_technology_zone_fingerprint",
        ),
        CheckConstraint(
            "correct_answer IS NULL OR "
            "correct_answer IN ('A', 'B', 'C', 'D')",
            name="ck_question_correct_answer",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    technology_id: Mapped[int] = mapped_column(
        ForeignKey(
            "technologies.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    zone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    question_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # Preserve old flashcard answers until conversion.
    # New MCQ imports leave this field NULL.
    answer_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    option_a: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    option_b: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    option_c: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    option_d: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    correct_answer: Mapped[str | None] = mapped_column(
        String(1),
        nullable=True,
    )

    explanation: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
