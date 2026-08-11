# ⚡ Chat-Y — Ultimate Hybrid AI Workspace

> **Experience the future of AI chat — zero setup, total privacy with in-browser WebLLM models, or blazing fast cloud inference powered by Groq, Gemini, NVIDIA NIM, & OpenRouter.**

Created with ❤️ by **Charan** ([@charan__3_](https://www.instagram.com/charan__3_/))

---

## 🌐 Quick Links

- 🚀 **Live Demo / Deployed Website**: [Your Vercel Deployment Link]
- 🐙 **GitHub Repository**: [Your GitHub Repository Link]
- 📸 **Instagram**: [@charan__3_](https://www.instagram.com/charan__3_/)

---

## 🌟 What is Chat-Y?

**Chat-Y** is a client-first, portable, and ultra-fast AI workspace. It combines **in-browser local WebLLM models** (using WebGPU) with **multi-cloud API providers** in a single interface designed for speed, privacy, and flexibility.

Whether you want **100% offline privacy** or **sub-second cloud responses**, Chat-Y adapts to your workflow.

---

## 🎯 Quick User Preference Guide — Which Mode Should You Choose?

When you enter Chat-Y for the first time, choose the mode that fits your priority:

| Your Priority | Recommended Mode & Model | Why? |
|---|---|---|
| 🔒 **100% Privacy / Sensitive Data** | **WebLLM Local** (`SmolLM`, `Llama 3.2 1B`) | **Zero data leaves your browser.** Runs 100% locally on your device via WebGPU. Free forever, works offline. |
| ⚡ **Lightning Speed Response** | **Groq API** (`llama-3.3-70b-versatile`) | **Fastest tokens/sec in the industry.** Instant answers, real-time typing, sub-second responses. |
| 🧠 **Deep Reasoning & Heavy Math** | **NVIDIA NIM API** (`nvidia/nemotron-4-340b`) | Enterprise-grade GPU reasoning for complex problem solving, research papers, and math. |
| 💎 **Code Generation & Multimodal** | **Google Gemini API** (`gemini-2.5-flash`) | Outstanding code completion, 1M+ token context windows, image/text analysis. |
| 🌐 **100+ Model Variety** | **OpenRouter API** (`claude-sonnet`, `gpt-4o`, `deepseek-r1`) | Access Claude 3.5, GPT-4o, DeepSeek-R1, Llama 3.3, and 100+ models with a single API key. |

---

## 🚀 How to Get Started in 3 Easy Steps

### Step 1: Claim Your Workspace Identity
When you open Chat-Y, you will be assigned a **Unique 10-Character User ID** (e.g. `25b91a05d8`). Enter your name to enter the workspace!

### Step 2: Choose Your AI Engine

#### 🅰️ **Option A: Use WebLLM (Free, No API Key Required)**
1. Open the Model Selector at the top right (or go to **Settings → Know Your LLM**).
2. Select **SmolLM2 360M** or **Llama 3.2 1B**.
3. Click **Download & Load**. The model downloads directly into your browser's IndexedDB storage and runs locally via WebGPU!

#### 🅱️ **Option B: Use Cloud APIs (Ultra-Fast)**
1. Click the **Settings Gear Icon** ⚙️ at the top right.
2. Go to the **API Keys** tab.
3. Paste your free API key for your preferred provider:
   - ⚡ **Groq**: [console.groq.com/keys](https://console.groq.com/keys) *(Pre-populated Base URL: `https://api.groq.com/openai/v1`)*
   - 💎 **Gemini**: [aistudio.google.com](https://aistudio.google.com/) *(Pre-populated Base URL: `https://generativelanguage.googleapis.com/v1beta/openai`)*
   - 🌐 **OpenRouter**: [openrouter.ai/keys](https://openrouter.ai/keys) *(Pre-populated Base URL: `https://openrouter.ai/api/v1`)*
   - 🧠 **NVIDIA NIM**: [build.nvidia.com](https://build.nvidia.com/) *(Pre-populated Base URL: `https://integrate.api.nvidia.com/v1`)*
4. Save key and start chatting!

---

## 🛠️ Features at a Glance

- ✦ **WebLLM WebGPU Local Models** — SmolLM 360M, Llama 3.2 1B, Qwen 2.5 1.5B
- ⚡ **Multi-Cloud API Providers** — Groq, Google Gemini, OpenRouter, NVIDIA NIM, OpenAI, Anthropic
- 🆔 **Unique User Identity** — 10-character unique User ID assigned on first visit
- 📚 **Know Your LLM Guide** — Built-in model selector & preference matrix in Settings
- 🎨 **Splash Screen Animations** — Dynamic icon entrance animation before entering workspace
- 📱 **100% Portable & Mobile Responsive** — Seamless UI across desktop, tablet, and mobile
- 🔒 **Privacy-First Architecture** — API keys stored strictly in your browser's localStorage

---

## 💻 Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion
- **Local AI Engine**: `@mlc-ai/web-llm` (WebGPU)
- **Icons & Typography**: Lucide React, Geist & Geist Mono

---

## 👤 Creator & Branding

- **Creator**: Charan
- **Instagram**: [@charan__3_](https://www.instagram.com/charan__3_/)
- **License**: MIT
