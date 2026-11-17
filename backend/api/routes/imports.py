
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
from sqlalchemy.orm import Session

from backend.api.admin_auth import require_admin
from backend.api.dependencies import get_db
from backend.models.technology import Technology
from backend.schemas.question import ImportResponse, Zone
from backend.services.import_service import (
    import_questions,
    parse_question_file,
)


router = APIRouter(
    prefix="/imports",
    tags=["Question Imports"],
    dependencies=[Depends(require_admin)],
)

DbSession = Annotated[Session, Depends(get_db)]

MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post(
    "/api/technologies/{technology_id}/{zone}",
    response_model=ImportResponse,
)
async def upload_questions(
    technology_id: int,
    zone: Zone,
    db: DbSession,
    file: UploadFile = File(...),
):
    technology = db.get(Technology, technology_id)

    if technology is None:
        raise HTTPException(
            status_code=404,
            detail="Technology not found",
        )

    content = await file.read(MAX_FILE_SIZE + 1)

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 5 MB",
        )

    questions = parse_question_file(
        filename=file.filename or "",
        content=content,
    )

    added, skipped = import_questions(
        db=db,
        technology_id=technology_id,
        zone=zone,
        questions=questions,
    )

    return ImportResponse(
        technology=technology.name,
        zone=zone,
        added=added,
        skipped_duplicates=skipped,
    )
