import re
import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_
from bs4 import BeautifulSoup

from app.database import get_db
from app.models import Note, Reminder, Goal, SpacedRepCard, DSASolveLog, UserPattern, Conversation, Message, APIKey, Memory
from app.schemas import NoteCreate, NoteResponse, ReminderCreate, ReminderResponse, GoalUpdate, GoalResponse, SpacedRepCardResponse, DSASolveLogResponse, UserPatternResponse, JarvisDataResponse
from app.services.system_stats import SystemStatsService
from app.services.search import SearchService

router = APIRouter()
stats_service = SystemStatsService()
search_service = SearchService()

# ─── API Keys & Settings Helpers ──────────────────────────────────────────────

async def get_settings_dict(db: AsyncSession) -> Dict[str, str]:
    keys_result = await db.execute(select(APIKey))
    keys = keys_result.scalars().all()
    
    settings = {
        "GROQ_API_KEY": "",
        "GROQ_API_KEY_2": "",
        "ELEVENLABS_API_KEY": "",
        "ELEVENLABS_VOICE_ID": "",
        "TELEGRAM_BOT_TOKEN": "",
        "TELEGRAM_CHAT_ID": ""
    }
    
    for key in keys:
        if key.provider == "groq" and key.is_active:
            settings["GROQ_API_KEY"] = key.api_key
        elif key.provider == "groq_2":
            settings["GROQ_API_KEY_2"] = key.api_key
        elif key.provider == "elevenlabs":
            settings["ELEVENLABS_API_KEY"] = key.api_key
        elif key.provider == "elevenlabs_voice":
            settings["ELEVENLABS_VOICE_ID"] = key.api_key
        elif key.provider == "telegram":
            settings["TELEGRAM_BOT_TOKEN"] = key.api_key
        elif key.provider == "telegram_chat":
            settings["TELEGRAM_CHAT_ID"] = key.api_key
            
    return settings

async def save_settings_dict(settings: Dict[str, str], db: AsyncSession):
    # Mapping settings keys to APIKey provider names
    mapping = {
        "GROQ_API_KEY": ("groq", "Groq Primary Key"),
        "GROQ_API_KEY_2": ("groq_2", "Groq Secondary Key"),
        "ELEVENLABS_API_KEY": ("elevenlabs", "ElevenLabs API Key"),
        "ELEVENLABS_VOICE_ID": ("elevenlabs_voice", "ElevenLabs Voice ID"),
        "TELEGRAM_BOT_TOKEN": ("telegram", "Telegram Bot Token"),
        "TELEGRAM_CHAT_ID": ("telegram_chat", "Telegram Chat ID")
    }
    
    for setting_key, (provider, key_name) in mapping.items():
        val = settings.get(setting_key, "").strip()
        if val is not None:
            # Check if exists
            result = await db.execute(select(APIKey).where(APIKey.provider == provider))
            existing = result.scalar_one_or_none()
            if existing:
                if val == "":
                    await db.delete(existing)
                else:
                    existing.api_key = val
            elif val != "":
                new_key = APIKey(
                    provider=provider,
                    key_name=key_name,
                    api_key=val,
                    is_active=True
                )
                db.add(new_key)
                
    await db.commit()

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/api/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await get_settings_dict(db)

@router.post("/api/settings")
async def save_settings(payload: Dict[str, str], db: AsyncSession = Depends(get_db)):
    try:
        await save_settings_dict(payload, db)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.delete("/api/delete-note/{id}")
async def delete_note(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Note).where(Note.id == id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    await db.delete(note)
    await db.commit()
    return {"ok": True}

@router.get("/api/data")
async def get_jarvis_data(db: AsyncSession = Depends(get_db)):
    # 1. Stats
    msg_count = (await db.execute(select(func.count(Message.id)))).scalar() or 0
    sess_count = (await db.execute(select(func.count(Conversation.id)))).scalar() or 0
    note_count = (await db.execute(select(func.count(Note.id)))).scalar() or 0
    fact_count = (await db.execute(select(func.count(Memory.id)))).scalar() or 0
    solved_count = (await db.execute(select(func.count(DSASolveLog.id)))).scalar() or 0
    
    # 2. System Stats
    sys_info = stats_service.get_stats()
    
    # 3. Sessions (Conversations mapping)
    conv_result = await db.execute(select(Conversation).order_by(Conversation.updated_at.desc()))
    convs = conv_result.scalars().all()
    sessions = [
        {
            "session_id": c.id,
            "msg_count": c.message_count or 0,
            "model_used": c.model or "groq/llama-3.3-70b-versatile"
        }
        for c in convs
    ]
    
    # 4. Messages (All or latest 100 for mapping)
    msg_result = await db.execute(select(Message).order_by(Message.created_at.asc()))
    msgs = msg_result.scalars().all()
    messages = [
        {
            "session_id": m.conversation_id,
            "role": m.role,
            "content": m.content,
            "ts": m.created_at.strftime("%H:%M:%S")
        }
        for m in msgs
    ]
    
    # 5. Notes
    notes_result = await db.execute(select(Note).order_by(Note.created_at.desc()))
    notes = notes_result.scalars().all()
    
    # 6. Memories / Facts
    facts_result = await db.execute(select(Memory).order_by(Memory.created_at.desc()))
    facts = facts_result.scalars().all()
    
    # 7. Reminders
    rem_result = await db.execute(select(Reminder).order_by(Reminder.created_at.desc()))
    reminders = rem_result.scalars().all()
    
    # 8. Patterns
    pats_result = await db.execute(select(UserPattern).order_by(UserPattern.count.desc()))
    patterns = pats_result.scalars().all()
    
    # 9. Goals
    goal_result = await db.execute(select(Goal).order_by(Goal.created_at.desc()).limit(1))
    goal = goal_result.scalar_one_or_none()
    if not goal:
        goal = Goal(dsa_target=2, dsa_completed=0, ml_target=1, ml_completed=0)
        db.add(goal)
        await db.commit()
        await db.refresh(goal)
        
    # 10. Spaced Rep Cards Due Today
    today_str = datetime.now().strftime("%Y-%m-%d")
    card_result = await db.execute(select(SpacedRepCard).where(SpacedRepCard.next_due <= today_str))
    spaced_due = card_result.scalars().all()
    
    # 11. DSA Topics
    topic_result = await db.execute(
        select(DSASolveLog.topic, func.count(DSASolveLog.id).label("count"))
        .group_by(DSASolveLog.topic)
        .order_by(func.count(DSASolveLog.id).desc())
    )
    dsa_topics = [{"topic": row[0], "count": row[1]} for row in topic_result.all()]
    
    # 12. DSA Logs
    logs_result = await db.execute(select(DSASolveLog).order_by(DSASolveLog.created_at.desc()))
    dsa_logs = logs_result.scalars().all()
    
    # 13. Daily Activity (Messages sent per day in the last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    activity_result = await db.execute(
        select(func.date(Message.created_at).label("day"), func.count(Message.id))
        .where(Message.created_at >= seven_days_ago)
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at).desc())
    )
    daily_activity = [{"day": str(row[0]), "count": row[1]} for row in activity_result.all()]
    
    # Return everything
    return {
        "stats": {
            "total_msgs": msg_count,
            "total_sessions": sess_count,
            "total_notes": note_count,
            "total_facts": fact_count,
            "total_dsa": solved_count
        },
        "system": sys_info,
        "status": "idle",
        "sessions": sessions,
        "messages": messages,
        "notes": notes,
        "facts": facts,
        "reminders": reminders,
        "patterns": patterns,
        "daily_activity": daily_activity,
        "goals": goal,
        "spaced_due": spaced_due,
        "dsa_topics": dsa_topics,
        "dsa_logs": dsa_logs
    }

# ─── Command Scraper Utility ──────────────────────────────────────────────────

async def scrape_url(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            
            # Remove scripts, styles
            for script in soup(["script", "style"]):
                script.decompose()
                
            text = soup.get_text()
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase for line in lines for phrase in line.split("  "))
            text = "\n".join(chunk for chunk in chunks if chunk)
            return text[:4000] + "\n... (truncated)" if len(text) > 4000 else text
    except Exception as e:
        return f"Error crawling URL: {str(e)}"


# ─── Jarvis Command Router & Executor ─────────────────────────────────────────

async def execute_jarvis_command(cmd: str, db: AsyncSession) -> str:
    cmd_stripped = cmd.strip()
    
    # 1. /goal <dsa_target> <ml_target>
    m_goal = re.match(r"^/goal\s+(\d+)\s+(\d+)$", cmd_stripped)
    if m_goal:
        dsa = int(m_goal.group(1))
        ml = int(m_goal.group(2))
        
        result = await db.execute(select(Goal).order_by(Goal.created_at.desc()).limit(1))
        goal = result.scalar_one_or_none()
        if goal:
            goal.dsa_target = dsa
            goal.ml_target = ml
        else:
            goal = Goal(dsa_target=dsa, dsa_completed=0, ml_target=ml, ml_completed=0)
            db.add(goal)
            
        await db.commit()
        return f"Sir, I have updated your targets. Daily target is now {dsa} DSA problems and {ml} ML projects."

    # 2. /spaced-rep rate <score> : <concept>
    m_sr = re.match(r"^/spaced-rep\s+rate\s+(\d+)\s*:\s*(.+)$", cmd_stripped)
    if m_sr:
        score = int(m_sr.group(1))
        concept = m_sr.group(2).strip()
        
        result = await db.execute(select(SpacedRepCard).where(SpacedRepCard.concept == concept))
        card = result.scalar_one_or_none()
        
        if card:
            interval = card.interval_days
            if score >= 3:
                interval = max(1, int(interval * 2.0))
            else:
                interval = 1
            card.interval_days = interval
            card.next_due = (datetime.now() + timedelta(days=interval)).strftime("%Y-%m-%d")
        else:
            interval = 2 if score >= 3 else 1
            card = SpacedRepCard(
                concept=concept,
                interval_days=interval,
                next_due=(datetime.now() + timedelta(days=interval)).strftime("%Y-%m-%d")
            )
            db.add(card)
            
        await db.commit()
        return f"Sir, card '{concept}' has been rated {score}. Next review scheduled in {interval} days ({card.next_due})."

    # 3. /dsa-log <topic> <problem_name> <difficulty>
    # Note: difficulty is case-insensitive, we split by whitespace but problem name might be quoted
    # Let's match quotes first, or try general pattern
    m_log = re.match(r'^/dsa-log\s+(\S+)\s+["\']?(.+?)["\']?\s+(Easy|Medium|Hard)$', cmd_stripped, re.IGNORECASE)
    if m_log:
        topic = m_log.group(1).strip()
        problem = m_log.group(2).strip()
        difficulty = m_log.group(3).strip().capitalize()
        
        new_log = DSASolveLog(
            topic=topic,
            problem_name=problem,
            difficulty=difficulty,
            outcome="solved"
        )
        db.add(new_log)
        
        # Increment dsa_completed in latest goal
        result = await db.execute(select(Goal).order_by(Goal.created_at.desc()).limit(1))
        goal = result.scalar_one_or_none()
        if goal:
            goal.dsa_completed = (goal.dsa_completed or 0) + 1
        else:
            goal = Goal(dsa_target=2, dsa_completed=1, ml_target=1, ml_completed=0)
            db.add(goal)
            
        await db.commit()
        return f"Sir, solve logged: '{problem}' under '{topic}' ({difficulty}). Daily progress updated to {goal.dsa_completed}/{goal.dsa_target} completed."

    # 4. /fetch <url> or /fetch <platform> <query>
    if cmd_stripped.startswith("/fetch"):
        parts = cmd_stripped.split(maxsplit=2)
        if len(parts) >= 2:
            target = parts[1]
            if target.startswith(("http://", "https://")):
                content = await scrape_url(target)
                return f"📋 **Scraped Web Content from {target}:**\n\n{content}"
            elif len(parts) == 3:
                platform = target
                query = parts[2]
                search_query = query
                if platform.lower() == "twitter":
                    search_query = f"site:twitter.com {query}"
                elif platform.lower() == "reddit":
                    search_query = f"site:reddit.com {query}"
                elif platform.lower() == "youtube":
                    search_query = f"site:youtube.com {query}"
                elif platform.lower() == "github":
                    search_query = f"site:github.com {query}"
                
                results = await search_service.search(search_query)
                if not results:
                    return f"No results found on {platform} for '{query}', Sir."
                
                lines = [f"🔍 **Social Search results ({platform.upper()}) for '{query}':**\n"]
                for idx, r in enumerate(results):
                    lines.append(f"### {idx+1}. {r['title']}\n**Link:** {r['url']}\n**Snippet:** {r['snippet']}\n")
                return "\n".join(lines)
        
        return "Usage: `/fetch <url>` or `/fetch <platform> <query>`"

    # 5. /note <title> : <body> or /note <body>
    m_note = re.match(r"^/note\s+(.+)$", cmd_stripped)
    if m_note:
        content = m_note.group(1).strip()
        if ":" in content:
            title, body = content.split(":", 1)
            title = title.strip()
            body = body.strip()
        else:
            title = "Quick Note"
            body = content
            
        new_note = Note(title=title, body=body)
        db.add(new_note)
        await db.commit()
        return f"Sir, note saved successfully: '{title}'."

    # 6. /remind <message> in <X> minutes
    m_rem = re.match(r"^/remind\s+(.+?)\s+in\s+(\d+)\s+minutes?$", cmd_stripped, re.IGNORECASE)
    if m_rem:
        msg = m_rem.group(1).strip()
        minutes = int(m_rem.group(2))
        due_time = (datetime.now() + timedelta(minutes=minutes)).strftime("%Y-%m-%d %H:%M")
        
        new_rem = Reminder(message=msg, due_ts=due_time, done=False)
        db.add(new_rem)
        await db.commit()
        return f"Sir, reminder scheduled at {due_time} for: '{msg}'."

    return f"Unknown command: '{cmd_stripped}'"

