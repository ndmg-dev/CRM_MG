from pydantic import BaseModel
from typing import TypeVar, Generic, List

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    content: List[T]
    totalElements: int
    totalPages: int
    page: int
    size: int
