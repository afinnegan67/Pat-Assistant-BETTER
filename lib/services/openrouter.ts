import type { ChatMessage } from '@/lib/utils/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const APP_URL = process.env.APP_URL || 'https://patricks-assistant.vercel.app';

// Model configuration
export const MODELS = {
  FAST: 'x-ai/grok-4.1-fast',           // Router, Task, Project, Transcript, Briefing, Reminder
  SMART: 'google/gemini-3-flash-preview' // Knowledge, Response
} as const;

interface OpenRouterResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  retries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': APP_URL,
          'X-Title': 'Patricks Assistant',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data: OpenRouterResponse = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      lastError = error as Error;
      console.error(`Attempt ${attempt + 1} failed:`, error);

      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('Failed to call OpenRouter after retries');
}

/**
 * Call the fast model (grok-4.1-fast) for routing, tasks, projects, etc.
 */
export async function callFastModel(messages: ChatMessage[]): Promise<string> {
  return callOpenRouter(MODELS.FAST, messages);
}

/**
 * Call the smart model (gemini-3-flash) for knowledge retrieval and response generation
 */
export async function callSmartModel(messages: ChatMessage[]): Promise<string> {
  return callOpenRouter(MODELS.SMART, messages);
}

/**
 * Call the fast model and parse JSON response
 */
export async function callFastModelJSON<T>(messages: ChatMessage[]): Promise<T> {
  const response = await callFastModel(messages);

  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${response}`);
  }
}

/**
 * Call the smart model and parse JSON response
 */
export async function callSmartModelJSON<T>(messages: ChatMessage[]): Promise<T> {
  const response = await callSmartModel(messages);

  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${response}`);
  }
}
