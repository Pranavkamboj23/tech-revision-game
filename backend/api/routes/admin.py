
from fastapi import APIRouter, Depends

from backend.api.admin_auth import require_admin


router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/verify")
def verify_admin():
    return {
        "authenticated": True,
        "message": "Admin access granted",
    }
