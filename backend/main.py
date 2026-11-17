
from fastapi import FastAPI

app = FastAPI(
    title="Tech Revision Game API",
    description="A gamified technical learning and revision platform",
    version="0.1.0"
)


@app.get("/")
async def home():
    return {
        "message": "Welcome to Tech Revision Game!",
        "status": "running",
        "version": "0.1.0"
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy"
    }
