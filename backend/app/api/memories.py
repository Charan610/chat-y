import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import Memory
from app.schemas import MemoryCreate, MemoryUpdate, MemoryResponse
from app.services.memory import MemoryService

router = APIRouter()
memory_service = MemoryService()


@router.get("/api/memories", response_model=list[MemoryResponse])
async def list_memories(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Memory)
    if category:
        query = query.where(Memory.category == category)
    if search:
        query = query.where(Memory.content.ilike(f"%{search}%"))
    query = query.order_by(Memory.is_pinned.desc(), Memory.updated_at.desc())
    result = await db.execute(query)
    memories = result.scalars().all()

    response = []
    for m in memories:
        tags = json.loads(m.tags) if m.tags else []
        response.append(MemoryResponse(
            id=m.id,
            category=m.category,
            content=m.content,
            tags=tags,
            created_at=m.created_at,
            updated_at=m.updated_at,
            is_pinned=m.is_pinned,
            vector_id=m.vector_id,
        ))
    return response


@router.post("/api/memories", response_model=MemoryResponse)
async def create_memory(data: MemoryCreate, db: AsyncSession = Depends(get_db)):
    memory_id = str(uuid.uuid4())
    memory = Memory(
        id=memory_id,
        category=data.category,
        content=data.content,
        tags=json.dumps(data.tags),
        is_pinned=data.is_pinned,
        vector_id=memory_id,
    )
    db.add(memory)
    await db.commit()
    await db.refresh(memory)

    # Add to vector store
    try:
        await memory_service.add_memory(
            memory_id=memory_id,
            content=data.content,
            metadata={"category": data.category, "tags": json.dumps(data.tags)}
        )
    except Exception:
        pass

    return MemoryResponse(
        id=memory.id,
        category=memory.category,
        content=memory.content,
        tags=data.tags,
        created_at=memory.created_at,
        updated_at=memory.updated_at,
        is_pinned=memory.is_pinned,
        vector_id=memory.vector_id,
    )


@router.patch("/api/memories/{memory_id}", response_model=MemoryResponse)
async def update_memory(
    memory_id: str,
    data: MemoryUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    if data.category is not None:
        memory.category = data.category
    if data.content is not None:
        memory.content = data.content
    if data.tags is not None:
        memory.tags = json.dumps(data.tags)
    if data.is_pinned is not None:
        memory.is_pinned = data.is_pinned
    memory.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(memory)

    tags = json.loads(memory.tags) if memory.tags else []
    return MemoryResponse(
        id=memory.id,
        category=memory.category,
        content=memory.content,
        tags=tags,
        created_at=memory.created_at,
        updated_at=memory.updated_at,
        is_pinned=memory.is_pinned,
        vector_id=memory.vector_id,
    )


@router.delete("/api/memories/{memory_id}")
async def delete_memory(memory_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Memory).where(Memory.id == memory_id))
    memory = result.scalar_one_or_none()
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    try:
        await memory_service.delete_memory(memory_id)
    except Exception:
        pass

    await db.delete(memory)
    await db.commit()
    return {"success": True}


@router.post("/api/memories/search")
async def search_memories(body: dict, db: AsyncSession = Depends(get_db)):
    query = body.get("query", "")
    n_results = body.get("n_results", 5)

    try:
        results = await memory_service.search_memories(query, n_results)
        return [{"content": r[0], "metadata": r[1], "distance": r[2]} for r in results]
    except Exception:
        # Fallback to DB search
        db_result = await db.execute(
            select(Memory).where(Memory.content.ilike(f"%{query}%")).limit(n_results)
        )
        memories = db_result.scalars().all()
        return [{"content": m.content, "metadata": {"category": m.category}, "distance": 0.0} for m in memories]
