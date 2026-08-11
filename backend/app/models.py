import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Integer, Float, Text, DateTime, ForeignKey
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="New Conversation")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    folder_id = Column(String, nullable=True)
    is_pinned = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    model = Column(String, default="groq/llama-3.3-70b-versatile")
    system_prompt = Column(Text, default="")
    message_count = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # user/assistant/system
    content = Column(Text, nullable=False)
    model = Column(String, nullable=True)
    provider = Column(String, nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    latency_ms = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)
    metadata_json = Column(Text, default="{}")
    is_pinned = Column(Boolean, default=False)
    reasoning_content = Column(Text, nullable=True)


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    provider = Column(String, nullable=False)
    key_name = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    base_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    extra_params = Column(Text, default="{}")


class ModelConfig(Base):
    __tablename__ = "model_configs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    model_id = Column(String, nullable=False)
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=4096)
    top_p = Column(Float, default=1.0)
    is_enabled = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    priority = Column(Integer, default=0)
    fallback_model_id = Column(String, nullable=True)
    description = Column(String, nullable=True)


class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String, default="general")
    content = Column(Text, nullable=False)
    tags = Column(Text, default="[]")  # JSON array
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    is_pinned = Column(Boolean, default=False)
    vector_id = Column(String, nullable=True)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    folder_type = Column(String, default="chat")  # chat/project
    created_at = Column(DateTime, default=utcnow)
    color = Column(String, nullable=True)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_path = Column(String, nullable=False)
    conversation_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    mime_type = Column(String, nullable=False)


# ─── JARVIS Models ────────────────────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=True, default="Note")
    body = Column(Text, nullable=False)
    ts = Column(String, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    created_at = Column(DateTime, default=utcnow)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    message = Column(Text, nullable=False)
    due_ts = Column(String, nullable=False)  # formatted "YYYY-MM-DD HH:MM"
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dsa_target = Column(Integer, default=2)
    dsa_completed = Column(Integer, default=0)
    ml_target = Column(Integer, default=1)
    ml_completed = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)


class SpacedRepCard(Base):
    __tablename__ = "spaced_rep_cards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    concept = Column(String, unique=True, nullable=False)
    interval_days = Column(Integer, default=1)
    next_due = Column(String, default=lambda: datetime.now().strftime("%Y-%m-%d"))
    created_at = Column(DateTime, default=utcnow)


class DSASolveLog(Base):
    __tablename__ = "dsa_solve_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    topic = Column(String, nullable=False)
    problem_name = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)  # Easy, Medium, Hard
    outcome = Column(String, default="solved")  # solved, attempted
    ts = Column(String, default=lambda: datetime.now().strftime("%Y-%m-%d %H:%M"))
    created_at = Column(DateTime, default=utcnow)


class UserPattern(Base):
    __tablename__ = "user_patterns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    pattern_key = Column(String, unique=True, nullable=False)  # e.g., 'topic:dsa', 'time:09-14'
    pattern_val = Column(String, nullable=False)
    count = Column(Integer, default=1)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

