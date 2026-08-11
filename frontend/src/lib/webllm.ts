/**
 * WebLLM Engine — Client-side LLM inference via WebGPU
 *
 * This module manages the lifecycle of a WebLLM engine instance:
 *   - Checks WebGPU support
 *   - Downloads & caches model weights (IndexedDB)
 *   - Runs inference entirely in-browser
 *   - Streams token-by-token responses
 */

import * as webllm from '@mlc-ai/web-llm';

// ── Available local models (small, fast, quantized) ──────────────────────────
export const LOCAL_MODELS = [
  {
    id: 'SmolLM-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M (Ultra-Light)',
    size: '~250 MB',
    description: 'Tiny model, fast on most GPUs. Good for simple tasks.',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct',
    size: '~700 MB',
    description: 'Great balance of quality and speed for in-browser use.',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 1.5B Instruct',
    size: '~1 GB',
    description: 'Higher quality reasoning, needs decent GPU.',
  },
] as const;

export type LocalModelId = typeof LOCAL_MODELS[number]['id'];

// ── Types ────────────────────────────────────────────────────────────────────
export interface WebLLMProgress {
  phase: 'downloading' | 'loading' | 'ready' | 'idle' | 'error';
  progress: number;     // 0-100
  text: string;         // Human-readable status
  timeElapsed?: number; // seconds
}

export type WebLLMStatus = 'unsupported' | 'idle' | 'loading' | 'ready' | 'error';

// ── Engine Singleton ─────────────────────────────────────────────────────────

let engineInstance: webllm.MLCEngine | null = null;
let currentModelId: string | null = null;
let engineStatus: WebLLMStatus = 'idle';

/**
 * Check if the browser supports WebGPU
 */
export function isWebGPUSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

/**
 * Get current engine status
 */
export function getEngineStatus(): WebLLMStatus {
  return engineStatus;
}

/**
 * Get the loaded model ID (if any)
 */
export function getLoadedModelId(): string | null {
  return currentModelId;
}

/**
 * Initialize (or re-initialize) the WebLLM engine with a specific model.
 * Reports progress through the callback.
 */
export async function initWebLLMEngine(
  modelId: string,
  onProgress: (progress: WebLLMProgress) => void,
): Promise<void> {
  if (!isWebGPUSupported()) {
    engineStatus = 'unsupported';
    onProgress({
      phase: 'error',
      progress: 0,
      text: 'WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.',
    });
    throw new Error('WebGPU not supported');
  }

  // If already loaded with the same model, skip
  if (engineInstance && currentModelId === modelId && engineStatus === 'ready') {
    onProgress({ phase: 'ready', progress: 100, text: 'Model already loaded' });
    return;
  }

  engineStatus = 'loading';
  const startTime = Date.now();

  onProgress({
    phase: 'downloading',
    progress: 0,
    text: `Preparing ${modelId}...`,
  });

  try {
    // Unload previous engine if switching models
    if (engineInstance) {
      engineInstance.unload();
      engineInstance = null;
      currentModelId = null;
    }

    const initProgressCallback = (report: webllm.InitProgressReport) => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const progressNum = Math.min(Math.round(report.progress * 100), 99);

      onProgress({
        phase: report.progress < 1 ? 'downloading' : 'loading',
        progress: progressNum,
        text: report.text,
        timeElapsed: elapsed,
      });
    };

    engineInstance = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback,
    });

    currentModelId = modelId;
    engineStatus = 'ready';
    onProgress({
      phase: 'ready',
      progress: 100,
      text: `Model loaded successfully (${Math.round((Date.now() - startTime) / 1000)}s)`,
    });
  } catch (err) {
    engineStatus = 'error';
    const errorMsg = err instanceof Error ? err.message : String(err);
    onProgress({
      phase: 'error',
      progress: 0,
      text: `Failed to load model: ${errorMsg}`,
    });
    throw err;
  }
}

/**
 * Run chat completion using the loaded WebLLM engine.
 * Streams tokens through the onChunk callback.
 */
export async function chatWithWebLLM(
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  onChunk: (token: string) => void,
  onDone: (fullText: string, stats: { promptTokens: number; completionTokens: number; totalTokens: number }) => void,
  onError: (error: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!engineInstance || engineStatus !== 'ready') {
    onError('WebLLM engine is not ready. Please load a model first.');
    return;
  }

  try {
    let fullText = '';

    const completion = await engineInstance.chat.completions.create({
      messages: messages as webllm.ChatCompletionMessageParam[],
      stream: true,
      temperature: 0.7,
      max_tokens: 2048,
    });

    for await (const chunk of completion) {
      if (signal?.aborted) {
        break;
      }
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onChunk(delta);
      }
    }

    // Get usage stats
    const usage = await engineInstance.runtimeStatsText();
    const statsMatch = usage.match(/(\d+)/g) || [];
    const promptTokens = parseInt(statsMatch[0] || '0', 10);
    const completionTokens = parseInt(statsMatch[1] || '0', 10);

    onDone(fullText, {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
  } catch (err) {
    if (signal?.aborted) return;
    const errorMsg = err instanceof Error ? err.message : String(err);
    onError(`WebLLM inference failed: ${errorMsg}`);
  }
}

/**
 * Reset / unload the engine
 */
export function unloadEngine(): void {
  if (engineInstance) {
    engineInstance.unload();
    engineInstance = null;
    currentModelId = null;
    engineStatus = 'idle';
  }
}
