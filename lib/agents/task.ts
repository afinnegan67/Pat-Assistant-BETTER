import type {
  AgentContext,
  TaskAgentResult,
  Task,
  ChatMessage,
  TaskPriority,
} from '@/lib/utils/types';
import { callFastModelJSON } from '@/lib/services/openrouter';
import {
  createTask,
  updateTask,
  completeTask,
  getTaskById,
  getTasksByProject,
  getPendingTasks,
  getOverdueTasks,
  getTodaysTasks,
  searchTasks,
} from '@/lib/db/queries';

const TASK_SYSTEM_PROMPT = `You are the task management agent for Patrick's construction assistant. You handle creating, updating, completing, and querying tasks.

You will receive:
- The user's intent (task_create, task_update, task_complete, task_query)
- Resolved entities (project IDs, task IDs if applicable)
- The user's message
- Today's conversation context

For task_create:
- Extract the task description
- Link to project if mentioned (use resolved project_id)
- Extract deadline if mentioned
- Extract priority if mentioned (default: medium)
- Return the created task details

For task_update:
- Identify which task to update (from resolved entities or active_context)
- Apply the requested changes
- Return the updated task details

For task_complete:
- Identify which task to complete
- Mark status as 'completed', set completed_at timestamp
- Return confirmation with task description

For task_query:
- Query tasks based on filters (project, status, deadline)
- Return list of matching tasks

Respond in JSON format:
{
  "action": "create" | "update" | "complete" | "query",
  "task_description": "string (for create)",
  "task_id": "string (for update/complete)",
  "project_id": "string or null",
  "deadline": "ISO date string or null",
  "priority": "low" | "medium" | "high" | "urgent" | null,
  "updates": { "field": "value" } (for update),
  "query_type": "all" | "project" | "overdue" | "today" | "search" (for query),
  "search_term": "string (for search query)"
}`;

interface TaskAgentResponse {
  action: 'create' | 'update' | 'complete' | 'query';
  task_description?: string;
  task_id?: string;
  project_id?: string | null;
  deadline?: string | null;
  priority?: TaskPriority | null;
  updates?: Partial<Pick<Task, 'description' | 'priority' | 'deadline' | 'status'>>;
  query_type?: 'all' | 'project' | 'overdue' | 'today' | 'search';
  search_term?: string;
}

function formatContextForPrompt(context: AgentContext): string {
  const parts: string[] = [
    `Intent: ${context.intent}`,
    `User message: "${context.userMessage}"`,
  ];

  if (context.resolvedEntities.projects.length > 0) {
    parts.push(`Resolved projects: ${context.resolvedEntities.projects.map(p => `${p.name} (${p.id})`).join(', ')}`);
  }

  if (context.resolvedEntities.tasks.length > 0) {
    parts.push(`Resolved tasks: ${context.resolvedEntities.tasks.map(t => `${t.description} (${t.id})`).join(', ')}`);
  }

  if (context.activeContext.current_task_id) {
    parts.push(`Current task in context: ${context.activeContext.current_task_id}`);
  }

  if (context.activeContext.current_project_id) {
    parts.push(`Current project in context: ${context.activeContext.current_project_id}`);
  }

  return parts.join('\n');
}

/**
 * Handle task-related intents
 */
export async function handleTaskIntent(context: AgentContext): Promise<TaskAgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: TASK_SYSTEM_PROMPT },
    {
      role: 'user',
      content: formatContextForPrompt(context),
    },
  ];

  try {
    const response = await callFastModelJSON<TaskAgentResponse>(messages);

    switch (response.action) {
      case 'create':
        return await handleTaskCreate(response, context);

      case 'update':
        return await handleTaskUpdate(response, context);

      case 'complete':
        return await handleTaskComplete(response, context);

      case 'query':
        return await handleTaskQuery(response, context);

      default:
        return {
          action: 'queried',
          task: null,
          tasks: null,
          error: 'Unknown action requested',
        };
    }
  } catch (error) {
    console.error('Task agent error:', error);
    return {
      action: 'queried',
      task: null,
      tasks: null,
      error: 'Your nephew Aidan failed to build me correctly. Blame him not me.',
    };
  }
}

async function handleTaskCreate(
  response: TaskAgentResponse,
  context: AgentContext
): Promise<TaskAgentResult> {
  if (!response.task_description) {
    return {
      action: 'created',
      task: null,
      tasks: null,
      error: 'No task description provided',
    };
  }

  // Use resolved project ID or from response
  const projectId = context.resolvedEntities.projects[0]?.id || response.project_id;

  const task = await createTask({
    description: response.task_description,
    project_id: projectId,
    deadline: response.deadline,
    priority: response.priority || 'medium',
  });

  return {
    action: 'created',
    task,
    tasks: null,
    error: null,
  };
}

async function handleTaskUpdate(
  response: TaskAgentResponse,
  context: AgentContext
): Promise<TaskAgentResult> {
  // Get task ID from response, resolved entities, or context
  const taskId = response.task_id
    || context.resolvedEntities.tasks[0]?.id
    || context.activeContext.current_task_id;

  if (!taskId) {
    return {
      action: 'updated',
      task: null,
      tasks: null,
      error: 'Could not identify which task to update',
    };
  }

  // Verify task exists
  const existingTask = await getTaskById(taskId);
  if (!existingTask) {
    return {
      action: 'updated',
      task: null,
      tasks: null,
      error: 'Task not found',
    };
  }

  // Build updates
  const updates: Partial<Pick<Task, 'description' | 'priority' | 'deadline' | 'status'>> = {};

  if (response.updates?.description) updates.description = response.updates.description;
  if (response.updates?.priority) updates.priority = response.updates.priority;
  if (response.updates?.deadline) updates.deadline = response.updates.deadline;
  if (response.updates?.status) updates.status = response.updates.status;
  if (response.priority) updates.priority = response.priority;
  if (response.deadline) updates.deadline = response.deadline;

  const task = await updateTask(taskId, updates);

  return {
    action: 'updated',
    task,
    tasks: null,
    error: null,
  };
}

async function handleTaskComplete(
  response: TaskAgentResponse,
  context: AgentContext
): Promise<TaskAgentResult> {
  // Get task ID from response, resolved entities, or context
  const taskId = response.task_id
    || context.resolvedEntities.tasks[0]?.id
    || context.activeContext.current_task_id;

  if (!taskId) {
    return {
      action: 'completed',
      task: null,
      tasks: null,
      error: 'Could not identify which task to complete',
    };
  }

  // Verify task exists
  const existingTask = await getTaskById(taskId);
  if (!existingTask) {
    return {
      action: 'completed',
      task: null,
      tasks: null,
      error: 'Task not found',
    };
  }

  const task = await completeTask(taskId);

  return {
    action: 'completed',
    task,
    tasks: null,
    error: null,
  };
}

async function handleTaskQuery(
  response: TaskAgentResponse,
  context: AgentContext
): Promise<TaskAgentResult> {
  let tasks: Task[] = [];

  switch (response.query_type) {
    case 'project':
      const projectId = context.resolvedEntities.projects[0]?.id
        || response.project_id
        || context.activeContext.current_project_id;

      if (projectId) {
        tasks = await getTasksByProject(projectId);
      } else {
        tasks = await getPendingTasks();
      }
      break;

    case 'overdue':
      tasks = await getOverdueTasks();
      break;

    case 'today':
      tasks = await getTodaysTasks();
      break;

    case 'search':
      if (response.search_term) {
        tasks = await searchTasks(response.search_term);
      } else {
        tasks = await getPendingTasks();
      }
      break;

    case 'all':
    default:
      tasks = await getPendingTasks();
      break;
  }

  return {
    action: 'queried',
    task: null,
    tasks,
    error: null,
  };
}
