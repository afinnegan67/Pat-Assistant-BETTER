import { generateText, Output } from 'ai';
import { fastModel } from '@/lib/services/ai-provider';
import { RouterResultSchema } from '@/lib/schemas/agent-schemas';
import type {
  RouterResult,
  ActiveContext,
  Message,
  Intent,
  TaskPriority,
} from '@/lib/utils/types';
import { buildContextSummary } from '@/lib/utils/context';

const ROUTER_SYSTEM_PROMPT = `You are a routing agent for Patrick's construction management assistant. Your job is to classify the user's intent and extract relevant entities.

Patrick is a construction project manager. He tracks tasks, manages multiple job sites (projects), and needs to stay organized.

Classify the intent into exactly one of:
- task_create: User wants to create a new task or to-do
- task_update: User wants to modify an existing task (priority, deadline, description)
- task_complete: User is marking a task as done
- task_query: User is asking about tasks (listing, filtering, searching)
- project_create: User wants to create a new project/job site
- project_update: User wants to modify a project (status, details)
- project_query: User is asking about a project's status or details
- schedule_query: User is asking about their schedule, calendar, or what they have to do
- knowledge_query: User is asking about past decisions, context, or information
- general_chat: Greetings, acknowledgments, or unclear intent

Also extract any mentioned:
- Project names (even partial or nicknames)
- Task references (descriptions or "that task", "the change order", etc.)
- Dates or deadlines mentioned
- Priority levels mentioned

If the user says "that task" or "this project", check the active_context to resolve what they mean.`;

function formatMessagesForContext(messages: Message[]): string {
  if (messages.length === 0) return 'No previous messages today.';

  const recent = messages.slice(-10); // Last 10 messages
  return recent
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
}

/**
 * Route a user message to determine intent and extract entities
 */
export async function routeMessage(
  userMessage: string,
  todaysMessages: Message[],
  activeContext: ActiveContext
): Promise<RouterResult> {
  try {
    const { output } = await generateText({
      model: fastModel,
      output: Output.object({
        schema: RouterResultSchema,
      }),
      system: ROUTER_SYSTEM_PROMPT,
      prompt: `Active Context:
${buildContextSummary(activeContext)}

Today's conversation so far:
${formatMessagesForContext(todaysMessages)}

New message from Patrick: "${userMessage}"

Classify this message and extract entities.`,
    });

    return {
      intent: output.intent as Intent,
      entities: {
        projects: output.entities.projects,
        tasks: output.entities.tasks,
        deadline: output.entities.deadline,
        priority: output.entities.priority as TaskPriority | null,
      },
      requires_lookup: output.requires_lookup,
      confidence: output.confidence,
    };
  } catch (error) {
    console.error('Router error:', error);

    // Default to general_chat on error
    return {
      intent: 'general_chat',
      entities: {
        projects: [],
        tasks: [],
        deadline: null,
        priority: null,
      },
      requires_lookup: false,
      confidence: 'low',
    };
  }
}

/**
 * Determine if a message needs a specialist agent or can go direct to response
 */
export function needsSpecialist(intent: Intent): boolean {
  const directToResponse: Intent[] = ['general_chat'];
  return !directToResponse.includes(intent);
}

/**
 * Determine which specialist agent to route to
 */
export function getSpecialistAgent(intent: Intent): 'task' | 'project' | 'knowledge' | 'schedule' | null {
  switch (intent) {
    case 'task_create':
    case 'task_update':
    case 'task_complete':
    case 'task_query':
      return 'task';

    case 'project_create':
    case 'project_update':
      return 'project';

    case 'project_query':
    case 'knowledge_query':
      return 'knowledge';

    case 'schedule_query':
      return 'schedule';

    default:
      return null;
  }
}
