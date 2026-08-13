import uuid
import os
import json
import mimetypes
from typing import List, Optional
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import aiofiles

from app.database import get_db
from app.models import UploadedFile
from app.schemas import UploadedFileResponse
from app.config import settings

router = APIRouter()

TEXT_PREVIEW_EXTENSIONS = {".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx",
                            ".json", ".csv", ".html", ".css", ".yaml", ".yml",
                            ".sh", ".bash", ".sql", ".xml", ".toml", ".ini",
                            ".cfg", ".log", ".rs", ".go", ".java", ".cpp",
                            ".c", ".h", ".rb", ".php", ".swift", ".kt"}


@router.post("/api/files/upload", response_model=List[UploadedFileResponse])
async def upload_files(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None),
    conversation_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_list = []
    if files:
        file_list.extend(files)
    if file:
        file_list.append(file)
    if not file_list:
        raise HTTPException(status_code=400, detail="No file provided")

    uploaded = []
    for item in file_list:
        # Check size
        content = await item.read()
        if len(content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File {item.filename} exceeds maximum size of {settings.MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        file_id = str(uuid.uuid4())
        original_name = item.filename or "unknown"
        ext = Path(original_name).suffix.lower()
        filename = f"{file_id}{ext}"
        file_path = os.path.join(settings.UPLOAD_DIR, filename)
        
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        
        mime_type = item.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
        file_type = _get_file_type(ext, mime_type)
        
        db_file = UploadedFile(
            id=file_id,
            filename=filename,
            original_name=original_name,
            file_type=file_type,
            file_size=len(content),
            file_path=file_path,
            conversation_id=conversation_id,
            mime_type=mime_type,
        )
        db.add(db_file)
        uploaded.append(db_file)
    
    await db.commit()
    for f in uploaded:
        await db.refresh(f)
    
    return uploaded


@router.get("/api/files", response_model=List[UploadedFileResponse])
async def list_files(
    conversation_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(UploadedFile)
    if conversation_id:
        query = query.where(UploadedFile.conversation_id == conversation_id)
    query = query.order_by(UploadedFile.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.delete("/api/files/{file_id}")
async def delete_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    db_file = result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete physical file
    if os.path.exists(db_file.file_path):
        os.remove(db_file.file_path)
    
    await db.delete(db_file)
    await db.commit()
    return {"success": True}


@router.get("/api/files/{file_id}/preview")
async def preview_file(file_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    db_file = result.scalar_one_or_none()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    
    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="Physical file not found")
    
    ext = Path(db_file.original_name).suffix.lower()
    
    if ext not in TEXT_PREVIEW_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Preview not available for this file type")
    
    try:
        async with aiofiles.open(db_file.file_path, "r", encoding="utf-8", errors="replace") as f:
            content = await f.read()
        # Limit to first 50KB for preview
        if len(content) > 51200:
            content = content[:51200] + "\n\n... (truncated for preview)"
        return {
            "id": db_file.id,
            "name": db_file.original_name,
            "content": content,
            "file_type": db_file.file_type,
            "size": db_file.file_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


def _get_file_type(ext: str, mime_type: str) -> str:
    if ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}:
        return "image"
    elif ext in {".mp4", ".webm", ".mov", ".avi", ".mkv"}:
        return "video"
    elif ext in {".mp3", ".wav", ".ogg", ".flac"}:
        return "audio"
    elif ext == ".pdf":
        return "pdf"
    elif ext in {".py", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java",
                 ".cpp", ".c", ".h", ".rb", ".php", ".swift", ".kt",
                 ".sh", ".bash", ".sql"}:
        return "code"
    elif ext in {".json", ".yaml", ".yml", ".toml", ".xml", ".ini", ".cfg"}:
        return "config"
    elif ext in {".md", ".txt"}:
        return "text"
    elif ext == ".csv":
        return "csv"
    elif mime_type.startswith("text/"):
        return "text"
    return "binary"
