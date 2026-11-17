
import csv
import hashlib
import io
import json

from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from backend.models.question import Question


def normalize_question(text: str) -> str:
    return " ".join(text.casefold().split())


def question_fingerprint(text: str) -> str:
    normalized = normalize_question(text)

    return hashlib.sha256(
        normalized.encode("utf-8")
    ).hexdigest()


def clean_required_string(
    value,
    field_name: str,
    row_number: int,
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                f"Row {row_number}: '{field_name}' "
                "must be a non-empty string"
            ),
        )

    return value.strip()


def parse_question_file(
    filename: str,
    content: bytes,
) -> list[dict]:
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="File must be UTF-8 encoded",
        ) from exc

    filename = filename.lower()

    if filename.endswith(".json"):
        try:
            data = json.loads(decoded)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid JSON file",
            ) from exc

        if isinstance(data, dict):
            rows = data.get("questions")
        else:
            rows = data

    elif filename.endswith(".csv"):
        try:
            reader = csv.DictReader(io.StringIO(decoded))

            if not reader.fieldnames:
                raise HTTPException(
                    status_code=400,
                    detail="CSV file must have a header row",
                )

            rows = list(reader)

        except csv.Error as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid CSV file",
            ) from exc

    else:
        raise HTTPException(
            status_code=400,
            detail="Only JSON and CSV files are supported",
        )

    if not isinstance(rows, list):
        raise HTTPException(
            status_code=400,
            detail="Expected a list of questions",
        )

    if not rows:
        raise HTTPException(
            status_code=400,
            detail="The file contains no questions",
        )

    cleaned_questions = []

    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid question at row {index}",
            )

        # Accept either "question" or "question_text".
        question = row.get(
            "question",
            row.get("question_text"),
        )

        question = clean_required_string(
            question,
            "question",
            index,
        )

        # JSON supports:
        # "options": {"A": "...", "B": "...", ...}
        #
        # CSV supports:
        # option_a,option_b,option_c,option_d
        options = row.get("options")

        if options is not None and not isinstance(options, dict):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Row {index}: 'options' "
                    "must be an object"
                ),
            )

        if isinstance(options, dict):
            option_a = options.get("A")
            option_b = options.get("B")
            option_c = options.get("C")
            option_d = options.get("D")
        else:
            option_a = row.get("option_a")
            option_b = row.get("option_b")
            option_c = row.get("option_c")
            option_d = row.get("option_d")

        option_a = clean_required_string(
            option_a, "option_a", index
        )
        option_b = clean_required_string(
            option_b, "option_b", index
        )
        option_c = clean_required_string(
            option_c, "option_c", index
        )
        option_d = clean_required_string(
            option_d, "option_d", index
        )

        # Prevent identical answer choices.
        normalized_options = {
            normalize_question(option)
            for option in (
                option_a,
                option_b,
                option_c,
                option_d,
            )
        }

        if len(normalized_options) != 4:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Row {index}: all four "
                    "options must be different"
                ),
            )

        correct_answer = row.get("correct_answer")

        correct_answer = clean_required_string(
            correct_answer,
            "correct_answer",
            index,
        ).upper()

        if correct_answer not in ("A", "B", "C", "D"):
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Row {index}: correct_answer "
                    "must be A, B, C, or D"
                ),
            )

        explanation = clean_required_string(
            row.get("explanation"),
            "explanation",
            index,
        )

        cleaned_questions.append(
            {
                "question_text": question,
                "option_a": option_a,
                "option_b": option_b,
                "option_c": option_c,
                "option_d": option_d,
                "correct_answer": correct_answer,
                "explanation": explanation,
                "answer_text": None,
                "fingerprint": question_fingerprint(
                    question
                ),
            }
        )

    return cleaned_questions


def import_questions(
    db: Session,
    technology_id: int,
    zone: str,
    questions: list[dict],
) -> tuple[int, int]:

    # Remove duplicates within the uploaded file.
    unique_questions = {}

    for question in questions:
        unique_questions.setdefault(
            question["fingerprint"],
            question,
        )

    rows = [
        {
            "technology_id": technology_id,
            "zone": zone,
            **question,
        }
        for question in unique_questions.values()
    ]

    if not rows:
        return 0, len(questions)

    # PostgreSQL has a limit on query parameters.
    # Import in manageable batches.
    inserted_count = 0
    batch_size = 100

    try:
        for start in range(0, len(rows), batch_size):
            batch = rows[start:start + batch_size]

            statement = (
                insert(Question)
                .values(batch)
                .on_conflict_do_nothing(
                    constraint=(
                        "uq_question_technology_zone_fingerprint"
                    )
                )
                .returning(Question.id)
            )

            inserted_ids = (
                db.execute(statement).scalars().all()
            )

            inserted_count += len(inserted_ids)

        db.commit()

    except Exception:
        db.rollback()
        raise

    skipped_count = len(questions) - inserted_count

    return inserted_count, skipped_count
