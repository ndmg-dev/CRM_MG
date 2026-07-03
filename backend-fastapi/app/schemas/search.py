from pydantic import BaseModel
from typing import List, Optional

class SearchResultItem(BaseModel):
    id: str
    type: str # 'sistema', 'cliente', 'tarefa'
    title: str
    subtitle: Optional[str] = None
    url: str
    icon: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResultItem]
