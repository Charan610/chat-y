from fastapi import APIRouter, HTTPException
from app.schemas import SearchRequest, SearchResult
from app.services.search import SearchService
from typing import List

router = APIRouter()
search_service = SearchService()


@router.post("/api/search", response_model=List[SearchResult])
async def web_search(request: SearchRequest):
    try:
        search_service = SearchService()
        results = await search_service.search(request.query, request.num_results)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
