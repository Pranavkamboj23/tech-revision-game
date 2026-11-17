
import secrets
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from backend.core.config import settings


admin_key_header = APIKeyHeader(
    name="X-Admin-Key",
    auto_error=False,
)


def require_admin(
    api_key: Annotated[
        str | None,
        Depends(admin_key_header),
    ],
) -> None:
    if (
        api_key is None
        or not secrets.compare_digest(
            api_key,
            settings.ADMIN_API_KEY,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing admin credentials",
        )
