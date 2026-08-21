from typing import List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReleaseNoteResponse(BaseModel):
    id: UUID
    system_name: str
    description: str
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class ReleaseResponse(BaseModel):
    id: UUID
    version: str
    released_at: datetime
    is_read: bool = False
    notes: List[ReleaseNoteResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ReleaseNoteCreate(BaseModel):
    system_name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=1000)


class ReleaseCreate(BaseModel):
    version: str = Field(min_length=1, max_length=50)
    notes: List[ReleaseNoteCreate] = Field(min_length=1)
