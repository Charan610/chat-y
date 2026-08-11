# Chat-Y — AI Workspace

A production-grade, multi-model AI workspace inspired by ChatGPT, Claude, Cursor, and VS Code.

## Quick Start (Local Development)

### 1. Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Docker (Full Stack)
```bash
docker-compose up --build
```

## Supported Providers
| Provider | Speed | Best For |
|---|---|---|
| ⚡ Groq | 200-800 tok/s | General Q&A, fast answers |
| 🧠 NVIDIA NIM | High | Deep reasoning, Nemotron 3 Ultra 550B |
| OpenAI | Medium | GPT-4o, coding |
| Anthropic | Medium | Claude 3.5, long context |
| Google | Medium | Gemini 1.5 Pro |
| OpenRouter | Varies | 200+ models |
| Ollama | Local | Privacy, local models |

## Configuration
Add your API keys in the Settings → API Keys panel within the app.

## Tech Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: FastAPI, Python, SQLite, LiteLLM
- **Vector DB**: ChromaDB (for memory)
- **Fonts**: Geist + Geist Mono
