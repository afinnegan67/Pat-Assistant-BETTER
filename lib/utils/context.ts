import type { ActiveContext, ResolvedEntities, Message } from '@/lib/utils/types';
import { getLastMessageContext, getTodaysMessages } from '@/lib/db/queries';

const MAX_RECENT_ENTITIES = 5;

/**
 * Create a fresh empty context
 */
export function createEmptyContext(): ActiveContext {
  return {
    current_task_id: undefined,
    current_project_id: undefined,
    recently_mentioned_tasks: [],
    recently_mentioned_projects: [],
  };
}

/**
 * Load the active context from the last message in today's conversation
 */
export async function loadActiveContext(conversationId: string): Promise<ActiveContext> {
  const lastContext = await getLastMessageContext(conversationId);
  return lastContext || createEmptyContext();
}

/**
 * Load today's messages for a conversation
 */
export async function loadTodaysMessages(conversationId: string): Promise<Message[]> {
  return getTodaysMessages(conversationId);
}

/**
 * Merge newly resolved entities into the active context
 */
export function mergeContext(
  existing: ActiveContext,
  newEntities: ResolvedEntities
): ActiveContext {
  const updatedContext: ActiveContext = {
    ...existing,
    recently_mentioned_tasks: [...existing.recently_mentioned_tasks],
    recently_mentioned_projects: [...existing.recently_mentioned_projects],
  };

  // Add new project IDs to recently mentioned, avoiding duplicates
  for (const project of newEntities.projects) {
    if (!updatedContext.recently_mentioned_projects.includes(project.id)) {
      updatedContext.recently_mentioned_projects.unshift(project.id);
    }
    // Set as current project
    updatedContext.current_project_id = project.id;
  }

  // Add new task IDs to recently mentioned, avoiding duplicates
  for (const task of newEntities.tasks) {
    if (!updatedContext.recently_mentioned_tasks.includes(task.id)) {
      updatedContext.recently_mentioned_tasks.unshift(task.id);
    }
    // Set as current task
    updatedContext.current_task_id = task.id;
  }

  // Trim to max recent entities
  updatedContext.recently_mentioned_tasks = updatedContext.recently_mentioned_tasks.slice(0, MAX_RECENT_ENTITIES);
  updatedContext.recently_mentioned_projects = updatedContext.recently_mentioned_projects.slice(0, MAX_RECENT_ENTITIES);

  return updatedContext;
}

/**
 * Check if the topic has changed significantly and clear current IDs if so
 */
export function detectTopicChange(
  previousMessages: Message[],
  newMessage: string
): boolean {
  if (previousMessages.length === 0) return false;

  // Simple heuristic: if the message mentions a completely new project/task
  // that wasn't in recent context, it might be a topic change
  // This is intentionally conservative to avoid clearing context unnecessarily
  return false;
}

/**
 * Update context when a task is created
 */
export function updateContextWithNewTask(
  existing: ActiveContext,
  taskId: string
): ActiveContext {
  return {
    ...existing,
    current_task_id: taskId,
    recently_mentioned_tasks: [
      taskId,
      ...existing.recently_mentioned_tasks.filter(id => id !== taskId),
    ].slice(0, MAX_RECENT_ENTITIES),
  };
}

/**
 * Update context when a project is created
 */
export function updateContextWithNewProject(
  existing: ActiveContext,
  projectId: string
): ActiveContext {
  return {
    ...existing,
    current_project_id: projectId,
    recently_mentioned_projects: [
      projectId,
      ...existing.recently_mentioned_projects.filter(id => id !== projectId),
    ].slice(0, MAX_RECENT_ENTITIES),
  };
}

/**
 * Clear the current task/project when moving to a new topic
 */
export function clearCurrentEntities(existing: ActiveContext): ActiveContext {
  return {
    ...existing,
    current_task_id: undefined,
    current_project_id: undefined,
  };
}

/**
 * Build a summary of the current context for agent prompts
 */
export function buildContextSummary(context: ActiveContext): string {
  const parts: string[] = [];

  if (context.current_project_id) {
    parts.push(`Current project: ${context.current_project_id}`);
  }

  if (context.current_task_id) {
    parts.push(`Current task: ${context.current_task_id}`);
  }

  if (context.recently_mentioned_projects.length > 0) {
    parts.push(`Recently mentioned projects: ${context.recently_mentioned_projects.join(', ')}`);
  }

  if (context.recently_mentioned_tasks.length > 0) {
    parts.push(`Recently mentioned tasks: ${context.recently_mentioned_tasks.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No active context.';
}
