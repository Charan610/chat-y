import uuid
import json
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import httpx
import os

from app.database import get_db
from app.models import APIKey, ModelConfig
from app.schemas import (
    APIKeyCreate, APIKeyUpdate, APIKeyResponse,
    ModelConfigCreate, ModelConfigUpdate, ModelConfigResponse
)

router = APIRouter()

PROVIDERS = [
    {
        "id": "groq",
        "name": "Groq",
        "description": "Ultra-fast LPU inference",
        "base_url": "https://api.groq.com/openai/v1",
        "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
    },
    {
        "id": "nvidia_nim",
        "name": "NVIDIA NIM",
        "description": "High-performance NVIDIA inference",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "models": ["nvidia/nemotron-3-ultra-550b-a55b", "meta/llama-3.1-70b-instruct"],
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "description": "GPT-4o and o1 series",
        "base_url": "https://api.openai.com/v1",
        "models": ["gpt-4o", "gpt-4o-mini", "o1", "o1-mini"],
    },
    {
        "id": "anthropic",
        "name": "Anthropic",
        "description": "Claude 3.5 Sonnet and Haiku",
        "base_url": "https://api.anthropic.com",
        "models": ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    },
    {
        "id": "google",
        "name": "Google Gemini",
        "description": "Gemini 1.5 Pro and Flash",
        "base_url": "https://generativelanguage.googleapis.com",
        "models": ["gemini/gemini-1.5-pro", "gemini/gemini-1.5-flash"],
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "description": "Access 200+ models",
        "base_url": "https://openrouter.ai/api/v1",
        "models": [],
    },
    {
        "id": "ollama",
        "name": "Ollama",
        "description": "Local models",
        "base_url": "http://localhost:11434",
        "models": [],
    },
]


@router.get("/api/providers")
async def list_providers():
    return PROVIDERS


# ---- Model Configs ----

@router.get("/api/models", response_model=list[ModelConfigResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).order_by(ModelConfig.priority.desc()))
    return result.scalars().all()


@router.post("/api/models", response_model=ModelConfigResponse)
async def create_model(data: ModelConfigCreate, db: AsyncSession = Depends(get_db)):
    model = ModelConfig(
        id=str(uuid.uuid4()),
        name=data.name,
        provider=data.provider,
        model_id=data.model_id,
        temperature=data.temperature,
        max_tokens=data.max_tokens,
        top_p=data.top_p,
        is_enabled=data.is_enabled,
        is_default=data.is_default,
        priority=data.priority,
        fallback_model_id=data.fallback_model_id,
        description=data.description,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


@router.patch("/api/models/{model_id}", response_model=ModelConfigResponse)
async def update_model(
    model_id: str,
    data: ModelConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(model, key, value)
    
    await db.commit()
    await db.refresh(model)
    return model


@router.delete("/api/models/{model_id}")
async def delete_model(model_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model config not found")
    await db.delete(model)
    await db.commit()
    return {"success": True}


# ---- API Keys ----

@router.get("/api/apikeys")
async def list_api_keys(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).order_by(APIKey.created_at.desc()))
    keys = result.scalars().all()
    return [APIKeyResponse.from_orm_mask(k) for k in keys]


@router.post("/api/apikeys", response_model=APIKeyResponse)
async def create_api_key(data: APIKeyCreate, db: AsyncSession = Depends(get_db)):
    key = APIKey(
        id=str(uuid.uuid4()),
        provider=data.provider,
        key_name=data.key_name,
        api_key=data.api_key,
        base_url=data.base_url,
        is_active=data.is_active,
        is_default=data.is_default,
        extra_params=data.extra_params,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)
    return APIKeyResponse.from_orm_mask(key)


@router.patch("/api/apikeys/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str,
    data: APIKeyUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    update_data = data.model_dump(exclude_unset=True)
    for k, value in update_data.items():
        setattr(key, k, value)

    await db.commit()
    await db.refresh(key)
    return APIKeyResponse.from_orm_mask(key)


@router.delete("/api/apikeys/{key_id}")
async def delete_api_key(key_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    await db.delete(key)
    await db.commit()
    return {"success": True}


@router.post("/api/apikeys/{key_id}/health-check")
async def health_check_key(key_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id))
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    try:
        if key.provider == "groq":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.groq.com/openai/v1/models",
                    headers={"Authorization": f"Bearer {key.api_key}"}
                )
                return {"status": "ok" if resp.status_code == 200 else "error", "http_status": resp.status_code}
        elif key.provider == "openai":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key.api_key}"}
                )
                return {"status": "ok" if resp.status_code == 200 else "error", "http_status": resp.status_code}
        elif key.provider == "anthropic":
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={"x-api-key": key.api_key, "anthropic-version": "2023-06-01"}
                )
                return {"status": "ok" if resp.status_code == 200 else "error", "http_status": resp.status_code}
        elif key.provider == "nvidia_nim":
            base = key.base_url or "https://integrate.api.nvidia.com/v1"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{base}/models",
                    headers={"Authorization": f"Bearer {key.api_key}"}
                )
                return {"status": "ok" if resp.status_code == 200 else "error", "http_status": resp.status_code}
        elif key.provider == "ollama":
            base = key.base_url or "http://localhost:11434"
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{base}/api/tags")
                return {"status": "ok" if resp.status_code == 200 else "error", "http_status": resp.status_code}
        else:
            return {"status": "unknown", "message": f"Health check not implemented for {key.provider}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
