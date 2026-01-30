import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const APP_URL = process.env.APP_URL || 'https://patricks-assistant.vercel.app';

// Create OpenRouter-compatible provider
export const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': APP_URL,
    'X-Title': 'Patricks Assistant',
  },
});

// Model configuration (same models as before)
export const MODELS = {
  FAST: 'x-ai/grok-4.1-fast',           // Router, Task, Project, Transcript, Briefing, Reminder
  SMART: 'google/gemini-3-flash-preview' // Knowledge, Response
} as const;

// Pre-configured model instances
export const fastModel = openrouter(MODELS.FAST);
export const smartModel = openrouter(MODELS.SMART);
