#!/bin/bash

# Chat-Y Launch Script
# Starts both Backend and Frontend, handles clean shutdown on Ctrl+C.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "🚀 Starting Chat-Y Workspace..."

# Function to clean up background processes on exit
cleanup() {
  echo -e "\n🛑 Stopping Chat-Y services..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}

# Trap Ctrl+C (SIGINT) and SIGTERM to run cleanup
trap cleanup SIGINT SIGTERM

# Check if ports are already in use
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null ; then
  echo "⚠️ Warning: Port 8000 is already in use. Attempting to start anyway..."
fi
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
  echo "⚠️ Warning: Port 3000 is already in use. Attempting to start anyway..."
fi

# Start Backend
echo "🐍 Starting FastAPI Backend..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 > "$BACKEND_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⌛ Waiting for backend to spin up..."
for i in {1..15}; do
  if curl -s http://localhost:8000/health >/dev/null; then
    echo "✓ Backend is healthy on http://localhost:8000"
    break
  fi
  if [ $i -eq 15 ]; then
    echo "❌ Timeout waiting for backend startup. Check backend/backend.log"
  fi
  sleep 1
done

# Start Frontend
echo "⚛️ Starting Next.js Frontend..."
cd "$FRONTEND_DIR"
npm run dev > "$FRONTEND_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

echo "✓ Frontend is booting on http://localhost:3000"
echo "------------------------------------------------"
echo "👉 Open: http://localhost:3000 in your browser"
echo "👉 Logs: backend/backend.log and frontend/frontend.log"
echo "👉 Press Ctrl+C in this terminal to shut down both servers."
echo "------------------------------------------------"

# Keep script running to maintain the background processes
while true; do
  sleep 1
done
