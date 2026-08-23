from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Folder
# ---------------------------------------------------------------------------

class FolderCreate(BaseModel):
    name: str
    folder_type: str = "chat"
    color: Optional[str] = None

class FolderResponse(BaseModel):
    id: str
    name: str
    folder_type: str
    color: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    id: str  # Google sub ID
    email: str
    name: str
    picture: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Conversation
# ---------------------------------------------------------------------------

class ConversationCreate(BaseModel):
    title: str = "New Conversation"
    model: str = "groq/llama-3.3-70b-versatile"
    system_prompt: str = ""
    folder_id: Optional[str] = None
    user_id: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    system_prompt: Optional[str] = None
    is_pinned: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    folder_id: Optional[str] = None

class ConversationResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    folder_id: Optional[str] = None
    is_pinned: bool
    is_favorite: bool
    is_archived: bool
    model: str
    system_prompt: str
    message_count: int
    total_tokens: int
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Message
# ---------------------------------------------------------------------------

class MessageCreate(BaseModel):
    role: str
    content: str
    model: Optional[str] = None
    metadata_json: Optional[str] = "{}"
    user_id: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    user_id: Optional[str] = None
    role: str
    content: str
    model: Optional[str] = None
    provider: Optional[str] = None
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    estimated_cost: float
    created_at: datetime
    metadata_json: str
    is_pinned: bool
    reasoning_content: Optional[str] = None
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# API Key
# ---------------------------------------------------------------------------

class APIKeyCreate(BaseModel):
    provider: str
    key_name: str
    api_key: str
    base_url: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    extra_params: str = "{}"

class APIKeyUpdate(BaseModel):
    provider: Optional[str] = None
    key_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None

class APIKeyResponse(BaseModel):
    id: str
    provider: str
    key_name: str
    api_key: Optional[str] = None
    api_key_masked: str  # masked version shown to client
    base_url: Optional[str] = None
    is_active: bool
    is_default: bool
    created_at: datetime
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_mask(cls, obj) -> "APIKeyResponse":
        """Build response with both api_key and masked version."""
        key = obj.api_key or ""
        if len(key) > 8:
            masked = key[:4] + "*" * (len(key) - 8) + key[-4:]
        else:
            masked = "****"
        return cls(
            id=obj.id,
            provider=obj.provider,
            key_name=obj.key_name,
            api_key=key,
            api_key_masked=masked,
            base_url=obj.base_url,
            is_active=obj.is_active,
            is_default=obj.is_default,
            created_at=obj.created_at,
        )

# ---------------------------------------------------------------------------
# Model Config
# ---------------------------------------------------------------------------

class ModelConfigCreate(BaseModel):
    name: str
    provider: str
    model_id: str
    temperature: float = 0.7
    max_tokens: int = 4096
    top_p: float = 1.0
    is_enabled: bool = True
    is_default: bool = False
    priority: int = 0
    fallback_model_id: Optional[str] = None
    description: Optional[str] = None

class ModelConfigUpdate(BaseModel):
    name: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    top_p: Optional[float] = None
    is_enabled: Optional[bool] = None
    is_default: Optional[bool] = None
    priority: Optional[int] = None
    fallback_model_id: Optional[str] = None
    description: Optional[str] = None

class ModelConfigResponse(BaseModel):
    id: str
    name: str
    provider: str
    model_id: str
    temperature: float
    max_tokens: int
    top_p: float
    is_enabled: bool
    is_default: bool
    priority: int
    fallback_model_id: Optional[str] = None
    description: Optional[str] = None
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Memory
# ---------------------------------------------------------------------------

class MemoryCreate(BaseModel):
    category: str = "general"
    content: str
    tags: List[str] = []
    is_pinned: bool = False

class MemoryUpdate(BaseModel):
    category: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    is_pinned: Optional[bool] = None

class MemoryResponse(BaseModel):
    id: str
    category: str
    content: str
    tags: List[str]
    created_at: datetime
    updated_at: Optional[datetime] = None
    is_pinned: bool
    vector_id: Optional[str] = None
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    user_id: Optional[str] = None
    message: str
    messages: Optional[List[Dict[str, Any]]] = None
    model: str = "groq/llama-3.3-70b-versatile"
    files: List[str] = []          # list of uploaded file IDs
    web_search: bool = False
    reasoning_mode: bool = False
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    api_keys: Optional[Dict[str, str]] = None

class ImportChatPayload(BaseModel):
    title: str = "Imported Chat"
    model: Optional[str] = "groq/llama-3.3-70b-versatile"
    messages: List[Dict[str, Any]] = []

class ImportChatsRequest(BaseModel):
    user_id: str
    chats: List[ImportChatPayload]

class ChatStreamChunk(BaseModel):
    type: str                              # content | metadata | done | error
    content: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class DailyStats(BaseModel):
    date: str
    messages: int
    tokens: int
    cost: float

class ModelStats(BaseModel):
    model: str
    messages: int
    tokens: int
    cost: float

class AnalyticsResponse(BaseModel):
    total_conversations: int
    total_messages: int
    total_tokens: int
    estimated_cost: float
    daily_stats: List[DailyStats] = []
    model_stats: List[ModelStats] = []

# ---------------------------------------------------------------------------
# File Upload
# ---------------------------------------------------------------------------

class UploadedFileResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_type: str
    file_size: int
    mime_type: str
    conversation_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------

class SearchRequest(BaseModel):
    query: str
    num_results: int = 5

class SearchResult(BaseModel):
    title: str
    url: str
    snippet: str


# ─── JARVIS Schemas ───────────────────────────────────────────────────────────

class NoteCreate(BaseModel):
    title: Optional[str] = "Note"
    body: str

class NoteResponse(BaseModel):
    id: int
    title: Optional[str]
    body: str
    ts: str
    created_at: datetime
    model_config = {"from_attributes": True}

class ReminderCreate(BaseModel):
    message: str
    due_ts: str

class ReminderResponse(BaseModel):
    id: int
    message: str
    due_ts: str
    done: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class GoalUpdate(BaseModel):
    dsa_target: Optional[int] = None
    dsa_completed: Optional[int] = None
    ml_target: Optional[int] = None
    ml_completed: Optional[int] = None

class GoalResponse(BaseModel):
    dsa_target: int
    dsa_completed: int
    ml_target: int
    ml_completed: int
    model_config = {"from_attributes": True}

class SpacedRepCardResponse(BaseModel):
    concept: str
    interval_days: int
    next_due: str
    model_config = {"from_attributes": True}

class DSASolveLogResponse(BaseModel):
    id: int
    topic: str
    problem_name: str
    difficulty: str
    outcome: str
    ts: str
    model_config = {"from_attributes": True}

class UserPatternResponse(BaseModel):
    pattern_key: str
    pattern_val: str
    count: int
    model_config = {"from_attributes": True}

class JarvisStats(BaseModel):
    total_msgs: int
    total_sessions: int
    total_notes: int
    total_facts: int
    total_dsa: int

class JarvisSystem(BaseModel):
    battery: int
    charging: bool
    ram_free_gb: float
    disk_free: str
    disk_total: str
    uptime: str

class JarvisSession(BaseModel):
    session_id: str
    msg_count: int
    model_used: str

class JarvisMessage(BaseModel):
    session_id: str
    role: str
    content: str
    ts: str

class JarvisDailyActivity(BaseModel):
    day: str
    count: int

class JarvisDataResponse(BaseModel):
    stats: JarvisStats
    system: JarvisSystem
    status: str
    sessions: List[JarvisSession]
    messages: List[JarvisMessage]
    notes: List[NoteResponse]
    facts: List[MemoryResponse]
    reminders: List[ReminderResponse]
    patterns: List[UserPatternResponse]
    daily_activity: List[JarvisDailyActivity]
    goals: GoalResponse
    spaced_due: List[SpacedRepCardResponse]
    dsa_topics: List[dict]
    dsa_logs: List[DSASolveLogResponse]

