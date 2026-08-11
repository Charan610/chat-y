import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import create_tables
from app.api.chat import router as chat_router
from app.api.models_mgr import router as models_router
from app.api.memories import router as memories_router
from app.api.files import router as files_router
from app.api.search import router as search_router
from app.api.analytics import router as analytics_router
from app.api.jarvis import router as jarvis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_PATH, exist_ok=True)
    await create_tables()
    print("✓ Chat-Y backend started")
    print(f"  Upload dir : {settings.UPLOAD_DIR}")
    print(f"  Chroma path: {settings.CHROMA_PATH}")
    yield
    # Shutdown
    print("Chat-Y backend shutting down")


app = FastAPI(
    title="Chat-Y API",
    description="Multi-model AI workspace backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Static file serving ─────────────────────────────────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ─── Routers ─────────────────────────────────────────────────────────────────
app.include_router(chat_router)
app.include_router(models_router)
app.include_router(memories_router)
app.include_router(files_router)
app.include_router(search_router)
app.include_router(analytics_router)
app.include_router(jarvis_router)


# ─── Root & Health ───────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"name": "Chat-Y API", "version": "1.0.0", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "chat-y-backend"}
