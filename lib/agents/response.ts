import { generateText } from 'ai';
import { smartModel } from '@/lib/services/ai-provider';
import type {
  Intent,
  Message,
  TaskAgentResult,
  ProjectAgentResult,
  KnowledgeAgentResult,
  Task,
  CalendarEvent,
} from '@/lib/utils/types';

const RESPONSE_SYSTEM_PROMPT = `You are the response generator for Patrick's construction assistant. You take structured results from specialist agents and generate natural language responses.

CRITICAL RULES:
1. Be matter-of-fact and blunt. No fluff, no corporate speak, no sycophancy.
2. Never use templates. Every response is unique.
3. Never apologize unless something actually went wrong.
4. Keep responses concise but complete.
5. Ask useful follow-up questions when relevant (e.g., "Did you finish anything else?")
6. Never use phrases like "Great!", "Absolutely!", "I'd be happy to", "Of course!", "Perfect!", "Awesome!", "Certainly!"

VOICE EXAMPLES:
- User marks task complete -> "Marked the Chen change order as complete. Anything else done?"
- User asks schedule -> "Today you have: [list]. Plus 3 overdue tasks from last week."
- User creates task -> "Added: Send change order to Chen client. Deadline set for Friday."
- Error occurred -> "Your nephew Aidan failed to build me correctly. Blame him not me."

When generating responses:
- If showing a list, keep it scannable but not bullet-heavy
- If the specialist returned an error, communicate it bluntly
- If clarification is needed, ask directly
- If multiple matches found, ask which one they mean

Generate only the response text, nothing else.`;

interface ResponseContext {
  intent: Intent;
  userMessage: string;
  todaysMessages: Message[];
  result?: TaskAgentResult | ProjectAgentResult | KnowledgeAgentResult | null;
  tasks?: Task[];
  events?: CalendarEvent[];
  error?: string;
}

function formatTaskForResponse(task: Task): string {
  const parts = [task.description];

  if (task.deadline) {
    const deadline = new Date(task.deadline);
    parts.push(`due ${deadline.toLocaleDateString()}`);
  }

  if (task.priority !== 'medium') {
    parts.push(`(${task.priority} priority)`);
  }

  return parts.join(' - ');
}

function buildResultSummary(context: ResponseContext): string {
  const { intent, result, tasks, events, error } = context;

  if (error) {
    return `Error: ${error}`;
  }

  if (intent === 'schedule_query') {
    const parts: string[] = [];

    if (tasks && tasks.length > 0) {
      parts.push(`Tasks (${tasks.length}):`);
      tasks.forEach(t => parts.push(`- ${formatTaskForResponse(t)}`));
    }

    if (events && events.length > 0) {
      parts.push(`\nCalendar events:`);
      events.forEach(e => {
        const time = new Date(e.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        parts.push(`- ${time}: ${e.summary}`);
      });
    }

    return parts.join('\n') || 'No tasks or events today.';
  }

  if (!result) {
    return 'No result from specialist agent.';
  }

  // Task agent result
  if ('action' in result && (result as TaskAgentResult).action) {
    const taskResult = result as TaskAgentResult;

    if (taskResult.error) {
      return `Error: ${taskResult.error}`;
    }

    switch (taskResult.action) {
      case 'created':
        return `Task created: ${formatTaskForResponse(taskResult.task!)}`;

      case 'updated':
        return `Task updated: ${formatTaskForResponse(taskResult.task!)}`;

      case 'completed':
        return `Task completed: ${taskResult.task!.description}`;

      case 'queried':
        if (!taskResult.tasks || taskResult.tasks.length === 0) {
          return 'No matching tasks found.';
        }
        return `Found ${taskResult.tasks.length} task(s):\n${taskResult.tasks.map(t => `- ${formatTaskForResponse(t)}`).join('\n')}`;
    }
  }

  // Project agent result
  if ('project' in result && (result as ProjectAgentResult).project) {
    const projectResult = result as ProjectAgentResult;

    if (projectResult.error) {
      return `Error: ${projectResult.error}`;
    }

    const project = projectResult.project!;
    if (projectResult.action === 'created') {
      return `Project created: ${project.name} (${project.status})`;
    } else {
      return `Project updated: ${project.name} is now ${project.status}`;
    }
  }

  // Knowledge agent result
  if ('answer' in result) {
    const knowledgeResult = result as KnowledgeAgentResult;
    return `${knowledgeResult.answer}\n\nConfidence: ${knowledgeResult.confidence}`;
  }

  return 'Result processed.';
}

/**
 * Generate a response based on the intent and specialist result
 */
export async function generateResponse(context: ResponseContext): Promise<string> {
  const resultSummary = buildResultSummary(context);

  try {
    const { text } = await generateText({
      model: smartModel,
      system: RESPONSE_SYSTEM_PROMPT,
      prompt: `Patrick said: "${context.userMessage}"

Intent classified as: ${context.intent}

Result from specialist agent:
${resultSummary}

Generate a natural, blunt response for Patrick. Remember: no fluff, no apologies, no corporate speak.`,
    });

    return text.trim();
  } catch (error) {
    console.error('Response generation error:', error);
    return 'Your nephew Aidan failed to build me correctly. Blame him not me.';
  }
}

/**
 * Generate a simple acknowledgment for general chat
 */
export async function generateGeneralChatResponse(
  userMessage: string,
  todaysMessages: Message[]
): Promise<string> {
  // For simple acknowledgments, don't need the full LLM
  const simpleResponses = [
    { pattern: /^(thanks|thank you|thx)/i, response: 'Yep.' },
    { pattern: /^(ok|okay|got it|gotcha)/i, response: 'Let me know if you need anything.' },
    { pattern: /^(hi|hello|hey)/i, response: 'What do you need?' },
    { pattern: /^(bye|later|goodbye)/i, response: 'Later.' },
  ];

  const lower = userMessage.toLowerCase().trim();
  for (const { pattern, response } of simpleResponses) {
    if (pattern.test(lower)) {
      return response;
    }
  }

  // For anything else, use the LLM
  try {
    const { text } = await generateText({
      model: smartModel,
      system: RESPONSE_SYSTEM_PROMPT,
      prompt: `Patrick said: "${userMessage}"

This is general chat - not a task, project, or query request. Generate a brief, natural response. Don't be robotic but don't be overly friendly either.`,
    });

    return text.trim();
  } catch (error) {
    console.error('Response generation error:', error);
    return 'Your nephew Aidan failed to build me correctly. Blame him not me.';
  }
}

/**
 * Generate a disambiguation response when multiple entities match
 */
export function generateDisambiguationResponse(
  entityType: 'project' | 'task',
  matches: { name: string; id: string }[] | { description: string; id: string }[]
): string {
  const labels = matches.map((m, i) => {
    const label = 'name' in m ? m.name : m.description;
    return `${i + 1}. ${label}`;
  });

  return `Which ${entityType} do you mean?\n${labels.join('\n')}`;
}
