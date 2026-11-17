
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.api.routes.admin import (
    router as admin_router,
)
from backend.api.routes.imports import (
    router as imports_router,
)
from backend.api.routes.question_management import (
    router as question_management_router,
)
from backend.api.routes.questions import (
    router as questions_router,
)
from backend.api.routes.technologies import (
    router as technologies_router,
)


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


app = FastAPI(
    title="Tech Revision Game API",
    version="0.2.0",
)


# Public and admin API routes
app.include_router(
    technologies_router,
    prefix="/api",
)

app.include_router(
    imports_router,
    prefix="/api",
)

app.include_router(
    questions_router,
    prefix="/api",
)

app.include_router(
    admin_router,
    prefix="/api",
)

app.include_router(
    question_management_router,
    prefix="/api",
)


# Frontend static assets
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND_DIR),
    name="static",
)


@app.get("/", include_in_schema=False)
def home():
    return FileResponse(
        FRONTEND_DIR / "index.html"
    )


@app.get("/admin", include_in_schema=False)
def admin_page():
    return FileResponse(
        FRONTEND_DIR / "admin.html"
    )


@app.get("/health")
def health():
    return {"status": "healthy"}
