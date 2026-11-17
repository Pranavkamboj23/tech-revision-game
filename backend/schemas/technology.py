
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TechnologyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str = Field(min_length=1, max_length=100)
    description: str | None = None


class TechnologyResponse(TechnologyCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
