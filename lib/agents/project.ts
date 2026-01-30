import type {
  AgentContext,
  ProjectAgentResult,
  ChatMessage,
  ProjectStatus,
} from '@/lib/utils/types';
import { callFastModelJSON } from '@/lib/services/openrouter';
import { createProject, updateProject, getProjectById } from '@/lib/db/queries';

const PROJECT_SYSTEM_PROMPT = `You are the project management agent for Patrick's construction assistant. You handle creating and updating projects (job sites).

Projects have:
- name (required): The project identifier, often a client name or address
- client_name: The client's name
- address: Job site address
- project_type: Type of work (kitchen, bathroom, deck, full_remodel, etc.)
- status: future, active, on_hold, completed

For project_create:
- Extract project name (required)
- Extract any other details mentioned
- Default status is 'future'

For project_update:
- Identify which project (from resolved entities)
- Apply changes (status updates, adding details)

Respond in JSON format:
{
  "action": "create" | "update",
  "name": "string (for create)",
  "project_id": "string (for update)",
  "client_name": "string or null",
  "address": "string or null",
  "project_type": "string or null",
  "status": "future" | "active" | "on_hold" | "completed" | null
}`;

interface ProjectAgentResponse {
  action: 'create' | 'update';
  name?: string;
  project_id?: string;
  client_name?: string | null;
  address?: string | null;
  project_type?: string | null;
  status?: ProjectStatus | null;
}

function formatContextForPrompt(context: AgentContext): string {
  const parts: string[] = [
    `Intent: ${context.intent}`,
    `User message: "${context.userMessage}"`,
  ];

  if (context.resolvedEntities.projects.length > 0) {
    parts.push(`Resolved projects: ${context.resolvedEntities.projects.map(p => `${p.name} (${p.id})`).join(', ')}`);
  }

  if (context.activeContext.current_project_id) {
    parts.push(`Current project in context: ${context.activeContext.current_project_id}`);
  }

  return parts.join('\n');
}

/**
 * Handle project-related intents
 */
export async function handleProjectIntent(context: AgentContext): Promise<ProjectAgentResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: PROJECT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: formatContextForPrompt(context),
    },
  ];

  try {
    const response = await callFastModelJSON<ProjectAgentResponse>(messages);

    if (response.action === 'create') {
      return await handleProjectCreate(response);
    } else {
      return await handleProjectUpdate(response, context);
    }
  } catch (error) {
    console.error('Project agent error:', error);
    return {
      action: 'created',
      project: null,
      error: 'Your nephew Aidan failed to build me correctly. Blame him not me.',
    };
  }
}

async function handleProjectCreate(
  response: ProjectAgentResponse
): Promise<ProjectAgentResult> {
  if (!response.name) {
    return {
      action: 'created',
      project: null,
      error: 'No project name provided',
    };
  }

  const project = await createProject({
    name: response.name,
    client_name: response.client_name,
    address: response.address,
    project_type: response.project_type,
    status: response.status || 'future',
  });

  return {
    action: 'created',
    project,
    error: null,
  };
}

async function handleProjectUpdate(
  response: ProjectAgentResponse,
  context: AgentContext
): Promise<ProjectAgentResult> {
  // Get project ID from response, resolved entities, or context
  const projectId = response.project_id
    || context.resolvedEntities.projects[0]?.id
    || context.activeContext.current_project_id;

  if (!projectId) {
    return {
      action: 'updated',
      project: null,
      error: 'Could not identify which project to update',
    };
  }

  // Verify project exists
  const existingProject = await getProjectById(projectId);
  if (!existingProject) {
    return {
      action: 'updated',
      project: null,
      error: 'Project not found',
    };
  }

  // Build updates
  const updates: Partial<{
    name: string;
    client_name: string | null;
    address: string | null;
    project_type: string | null;
    status: ProjectStatus;
  }> = {};

  if (response.name) updates.name = response.name;
  if (response.client_name !== undefined) updates.client_name = response.client_name;
  if (response.address !== undefined) updates.address = response.address;
  if (response.project_type !== undefined) updates.project_type = response.project_type;
  if (response.status) updates.status = response.status;

  const project = await updateProject(projectId, updates);

  return {
    action: 'updated',
    project,
    error: null,
  };
}
