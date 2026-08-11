from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from datetime import datetime, timedelta, timezone
from typing import List

from app.database import get_db
from app.models import Conversation, Message
from app.schemas import AnalyticsResponse, DailyStats, ModelStats

router = APIRouter()


@router.get("/api/analytics/overview", response_model=AnalyticsResponse)
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    # Total conversations
    conv_count = await db.execute(select(func.count(Conversation.id)))
    total_conversations = conv_count.scalar() or 0

    # Total messages
    msg_count = await db.execute(select(func.count(Message.id)))
    total_messages = msg_count.scalar() or 0

    # Total tokens and cost
    token_cost = await db.execute(
        select(func.sum(Message.total_tokens), func.sum(Message.estimated_cost))
    )
    row = token_cost.one()
    total_tokens = row[0] or 0
    estimated_cost = row[1] or 0.0

    return AnalyticsResponse(
        total_conversations=total_conversations,
        total_messages=total_messages,
        total_tokens=total_tokens,
        estimated_cost=estimated_cost,
    )


@router.get("/api/analytics/daily")
async def analytics_daily(db: AsyncSession = Depends(get_db)):
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    result = await db.execute(
        select(
            func.date(Message.created_at).label("date"),
            func.count(Message.id).label("messages"),
            func.sum(Message.total_tokens).label("tokens"),
            func.sum(Message.estimated_cost).label("cost"),
        )
        .where(Message.created_at >= thirty_days_ago)
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at).asc())
    )
    rows = result.all()

    return [
        {
            "date": str(row.date),
            "messages": row.messages or 0,
            "tokens": row.tokens or 0,
            "cost": float(row.cost or 0.0),
        }
        for row in rows
    ]


@router.get("/api/analytics/models")
async def analytics_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            Message.model,
            func.count(Message.id).label("messages"),
            func.sum(Message.total_tokens).label("tokens"),
            func.sum(Message.estimated_cost).label("cost"),
        )
        .where(Message.role == "assistant")
        .where(Message.model != None)
        .group_by(Message.model)
        .order_by(func.count(Message.id).desc())
    )
    rows = result.all()

    return [
        {
            "model": row.model,
            "messages": row.messages or 0,
            "tokens": row.tokens or 0,
            "cost": float(row.cost or 0.0),
        }
        for row in rows
    ]
