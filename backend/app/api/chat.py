import uuid
import json
import time
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Conversation, Message, User
from app.schemas import (
    ConversationCreate, ConversationUpdate, ConversationResponse,
    MessageCreate, MessageResponse, ChatRequest, UserCreate, UserResponse,
    ImportChatsRequest
)
from app.services.llm import LLMService
from app.services.search import SearchService
from app.api.jarvis import execute_jarvis_command

router = APIRouter()
llm_service = LLMService()
search_service = SearchService()

# ---- Users ----

@router.post("/api/users", response_model=UserResponse)
async def sync_user(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == data.id))
    user = result.scalar_one_or_none()
    if user:
        user.name = data.name
        user.email = data.email
        if data.picture:
            user.picture = data.picture
    else:
        user = User(
            id=data.id,
            email=data.email,
            name=data.name,
            picture=data.picture,
        )
        db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

# ---- Conversations ----

@router.post("/api/conversations", response_model=ConversationResponse)
async def create_conversation(data: ConversationCreate, db: AsyncSession = Depends(get_db)):
    conv = Conversation(
        id=str(uuid.uuid4()),
        user_id=data.user_id,
        title=data.title,
        model=data.model,
        system_prompt=data.system_prompt,
        folder_id=data.folder_id,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/api/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    search: Optional[str] = Query(None),
    folder_id: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    user_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(Conversation)
    if user_id:
        query = query.where(Conversation.user_id == user_id)
    if search:
        query = query.where(Conversation.title.ilike(f"%{search}%"))
    if folder_id:
        query = query.where(Conversation.folder_id == folder_id)
    if is_archived is not None:
        query = query.where(Conversation.is_archived == is_archived)
    else:
        query = query.where(Conversation.is_archived == False)
    query = query.order_by(Conversation.is_pinned.desc(), Conversation.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/api/conversations/import")
async def import_conversations(data: ImportChatsRequest, db: AsyncSession = Depends(get_db)):
    imported_count = 0
    for chat in data.chats:
        conv_id = str(uuid.uuid4())
        conv = Conversation(
            id=conv_id,
            user_id=data.user_id,
            title=chat.title or "Imported Chat",
            model=chat.model or "groq/llama-3.3-70b-versatile",
        )
        db.add(conv)
        for msg in chat.messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if not content:
                continue
            db_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conv_id,
                user_id=data.user_id,
                role=role,
                content=content,
                model=chat.model,
                provider=msg.get("provider", "imported"),
            )
            db.add(db_msg)
        imported_count += 1
    await db.commit()
    return {"imported": imported_count}


@router.get("/api/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/api/conversations/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    data: ConversationUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(conv, key, value)
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.delete("/api/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # Delete messages first
    await db.execute(delete(Message).where(Message.conversation_id == conversation_id))
    await db.delete(conv)
    await db.commit()
    return {"success": True}


@router.get("/api/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(conversation_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.post("/api/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def add_message(
    conversation_id: str,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db)
):
    # Verify conversation exists
    result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=data.role,
        content=data.content,
        model=data.model,
        metadata_json=data.metadata_json or "{}",
    )
    db.add(msg)
    conv.message_count = (conv.message_count or 0) + 1
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return msg


# ---- Streaming Chat ----

@router.post("/api/chat/stream")
async def stream_chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Main streaming chat endpoint using Server-Sent Events.
    """
    async def generate() -> AsyncGenerator[str, None]:
        try:
            # Intercept slash commands
            msg_stripped = request.message.strip()
            if msg_stripped.startswith("/"):
                conversation_id = request.conversation_id or str(uuid.uuid4())
                
                # Check if conversation exists
                if request.conversation_id:
                    result = await db.execute(
                        select(Conversation).where(Conversation.id == request.conversation_id)
                    )
                    conv = result.scalar_one_or_none()
                    if not conv:
                        conv = Conversation(
                            id=request.conversation_id,
                            title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                            model=request.model,
                            system_prompt=request.system_prompt or "",
                        )
                        db.add(conv)
                else:
                    conv = Conversation(
                        id=conversation_id,
                        title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                        model=request.model,
                        system_prompt=request.system_prompt or "",
                    )
                    db.add(conv)
                
                conv.message_count = (conv.message_count or 0) + 1
                conv.updated_at = datetime.now(timezone.utc)
                
                # Save user message
                user_msg = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conversation_id,
                    role="user",
                    content=request.message,
                    metadata_json="{}",
                )
                db.add(user_msg)
                await db.commit()

                yield f'data: {json.dumps({"type": "conversation_id", "content": conversation_id})}\n\n'

                # Execute command
                reply_text = await execute_jarvis_command(msg_stripped, db)
                
                # Save assistant response
                assistant_msg = Message(
                    id=str(uuid.uuid4()),
                    conversation_id=conversation_id,
                    role="assistant",
                    content=reply_text,
                    model=request.model,
                    provider="jarvis"
                )
                db.add(assistant_msg)
                
                # Refresh conv
                conv_result = await db.execute(select(Conversation).where(Conversation.id == conversation_id))
                conv_obj = conv_result.scalar_one()
                conv_obj.message_count = (conv_obj.message_count or 0) + 1
                conv_obj.updated_at = datetime.now(timezone.utc)
                
                await db.commit()
                
                yield f'data: {json.dumps({"type": "chunk", "content": reply_text})}\n\n'
                yield f'data: {json.dumps({"type": "done", "message_id": assistant_msg.id})}\n\n'
                return

            # Get or create conversation
            if request.conversation_id:
                result = await db.execute(
                    select(Conversation).where(Conversation.id == request.conversation_id)
                )
                conv = result.scalar_one_or_none()
                if not conv:
                    conv = Conversation(
                        id=request.conversation_id,
                        title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                        model=request.model,
                        system_prompt=request.system_prompt or "",
                    )
                    db.add(conv)
                    await db.commit()
            else:
                conv = Conversation(
                    id=str(uuid.uuid4()),
                    title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                    model=request.model,
                    system_prompt=request.system_prompt or "",
                )
                db.add(conv)
                await db.commit()

            conversation_id = conv.id

            # Send conversation_id to client first
            yield f'data: {json.dumps({"type": "conversation_id", "content": conversation_id})}\n\n'

            # Get conversation history
            history_result = await db.execute(
                select(Message)
                .where(Message.conversation_id == conversation_id)
                .order_by(Message.created_at.asc())
                .limit(50)
            )
            history = history_result.scalars().all()

            # Build messages list with current date context
            today_str = datetime.now(timezone.utc).strftime("%A, %B %d, %Y")
            date_system_prompt = f"Current Date: {today_str}. You are Chat-Y, an up-to-date, intelligent AI workspace assistant. Always provide accurate, real-time answers."

            messages = []
            if conv.system_prompt:
                messages.append({"role": "system", "content": f"{conv.system_prompt}\n{date_system_prompt}"})
            elif request.system_prompt:
                messages.append({"role": "system", "content": f"{request.system_prompt}\n{date_system_prompt}"})
            else:
                messages.append({"role": "system", "content": date_system_prompt})

            for h in history:
                messages.append({"role": h.role, "content": h.content})

            # Handle web search (auto-trigger if query mentions temporal terms or request.web_search is True)
            import re
            is_temporal = request.web_search or bool(re.search(r'\b(today|latest|recent|news|current|who won|score|weather|this week|2026|right now|now|happened|price|stock)\b', request.message, re.I))
            user_content = request.message

            if is_temporal:
                try:
                    search_results = await search_service.search(request.message)
                    if search_results:
                        search_context = "\n\nReal-Time Web Search Results:\n"
                        for i, r in enumerate(search_results, 1):
                            search_context += f"[{i}] [{r['title']}]({r['url']})\nSnippet: {r['snippet']}\n\n"
                        search_context += "INSTRUCTIONS: Answer using the real-time web search results above. Cite sources as markdown links like [1](URL)."
                        user_content = request.message + search_context
                except Exception:
                    pass  # Continue without search results

            messages.append({"role": "user", "content": user_content})

            # Save user message
            user_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role="user",
                content=request.message,
                metadata_json=json.dumps({"files": request.files, "web_search": request.web_search}),
            )
            db.add(user_msg)
            conv.message_count = (conv.message_count or 0) + 1
            conv.updated_at = datetime.now(timezone.utc)
            await db.commit()

            # Stream from LLM
            full_content = ""
            metadata = {}
            reasoning_content = ""

            from app.models import APIKey
            keys_result = await db.execute(
                select(APIKey).where(APIKey.is_active == True)
            )
            api_keys = keys_result.scalars().all()
            api_keys_dict = {k.provider: {"api_key": k.api_key, "base_url": k.base_url} for k in api_keys}

            if request.api_keys:
                for prov, key_val in request.api_keys.items():
                    if key_val and prov not in api_keys_dict:
                        api_keys_dict[prov] = {"api_key": key_val, "base_url": None}

            options = {
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "reasoning_mode": request.reasoning_mode,
            }

            async for chunk in llm_service.stream_chat(messages, request.model, api_keys_dict, options):
                if chunk["type"] == "content":
                    full_content += chunk["content"]
                    yield f'data: {json.dumps(chunk)}\n\n'
                elif chunk["type"] == "reasoning":
                    reasoning_content += chunk.get("content", "")
                    yield f'data: {json.dumps(chunk)}\n\n'
                elif chunk["type"] == "metadata":
                    metadata = chunk
                    yield f'data: {json.dumps(chunk)}\n\n'
                elif chunk["type"] == "error":
                    yield f'data: {json.dumps(chunk)}\n\n'
                    return
                elif chunk["type"] == "done":
                    break

            # Save assistant message
            assistant_msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conversation_id,
                role="assistant",
                content=full_content,
                model=metadata.get("model", request.model),
                provider=request.model.split("/")[0] if "/" in request.model else "openai",
                prompt_tokens=metadata.get("prompt_tokens", 0),
                completion_tokens=metadata.get("completion_tokens", 0),
                total_tokens=metadata.get("total_tokens", 0),
                latency_ms=metadata.get("latency_ms", 0),
                estimated_cost=metadata.get("estimated_cost", 0.0),
                reasoning_content=reasoning_content if reasoning_content else None,
            )
            db.add(assistant_msg)
            conv.message_count = (conv.message_count or 0) + 1
            conv.total_tokens = (conv.total_tokens or 0) + metadata.get("total_tokens", 0)
            conv.updated_at = datetime.now(timezone.utc)
            await db.commit()

            yield f'data: {json.dumps({"type": "done", "message_id": assistant_msg.id})}\n\n'

        except Exception as e:
            yield f'data: {json.dumps({"type": "error", "content": str(e)})}\n\n'

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
