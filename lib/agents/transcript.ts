import { generateText, tool } from 'ai';
import { fastModel } from '@/lib/services/ai-provider';
import { TranscriptResultSchema, type TranscriptResultOutput } from '@/lib/schemas/agent-schemas';
import type {
  TranscriptProcessingResult,
  TaskPriority,
  KnowledgeSource,
} from '@/lib/utils/types';
import { createTask, createProject, addProjectKnowledge, getProjectByName, getAllProjects } from '@/lib/db/queries';
import { generateEmbedding } from '@/lib/db/embeddings';

const TRANSCRIPT_SYSTEM_PROMPT = `You are the transcript processor for Patrick's construction assistant. You analyze meeting transcripts and voice notes to extract:

1. TASKS: Action items, to-dos, things that need to be done
   - Include who mentioned it
   - Include any deadline mentioned
   - Include which project it relates to (if mentioned)

2. PROJECT KNOWLEDGE: Decisions made, information discussed, updates
   - Group by project
   - Keep chunks atomic (one fact/decision per chunk)
   - Include context for why the decision was made if available

3. NEW PROJECTS: Any new job sites or projects mentioned that don't exist

Be thorough but precise. Don't invent information not in the transcript.`;

/**
 * Process a transcript and extract tasks, knowledge, and new projects
 */
export async function processTranscript(
  transcript: string,
  source: 'telegram' | 'webapp'
): Promise<TranscriptProcessingResult> {
  // Get existing projects for context
  const existingProjects = await getAllProjects();
  const projectNames = existingProjects.map(p => p.name).join(', ');

  try {
    const { toolCalls } = await generateText({
      model: fastModel,
      tools: {
        extractFromTranscript: tool({
          description: 'Extract tasks, knowledge, and new projects from the transcript',
          inputSchema: TranscriptResultSchema,
        }),
      },
      toolChoice: { type: 'tool', toolName: 'extractFromTranscript' },
      system: TRANSCRIPT_SYSTEM_PROMPT,
      prompt: `Existing projects: ${projectNames || 'None'}

Transcript:
${transcript}

Extract all tasks, knowledge, and new projects from this transcript. You MUST call the extractFromTranscript tool with your results.`,
    });

    const toolCall = toolCalls[0];
    if (!toolCall || toolCall.dynamic) {
      throw new Error('No tool call result received');
    }
    const result = toolCall.input as TranscriptResultOutput;

    // Zod schema already validated and provided defaults
    return result as TranscriptProcessingResult;
  } catch (error) {
    console.error('Transcript processing error:', error);
    return {
      tasks: [],
      knowledge: [],
      new_projects: [],
    };
  }
}

/**
 * Commit extracted data to the database
 */
export async function commitTranscriptData(
  result: TranscriptProcessingResult,
  sourceId: string
): Promise<{
  tasksCreated: number;
  knowledgeAdded: number;
  projectsCreated: number;
}> {
  let tasksCreated = 0;
  let knowledgeAdded = 0;
  let projectsCreated = 0;

  // Create new projects first (so we can link tasks/knowledge to them)
  const projectMap = new Map<string, string>(); // name -> id

  for (const newProject of result.new_projects) {
    if (!newProject.name) continue;

    // Check if project already exists
    const existing = await getProjectByName(newProject.name);
    if (existing) {
      projectMap.set(newProject.name.toLowerCase(), existing.id);
      continue;
    }

    const project = await createProject({
      name: newProject.name,
      client_name: newProject.client_name,
      project_type: newProject.project_type,
      status: 'future',
    });

    projectMap.set(newProject.name.toLowerCase(), project.id);
    projectsCreated++;
  }

  // Create tasks
  for (const task of result.tasks) {
    if (!task.description) continue;

    let projectId: string | null = null;
    if (task.project_name) {
      // Try to find project ID
      const existing = await getProjectByName(task.project_name);
      projectId = existing?.id || projectMap.get(task.project_name.toLowerCase()) || null;
    }

    await createTask({
      description: task.description,
      project_id: projectId,
      deadline: task.deadline,
      priority: (task.priority || 'medium') as TaskPriority,
    });

    tasksCreated++;
  }

  // Add knowledge chunks
  for (const knowledge of result.knowledge) {
    if (!knowledge.content) continue;

    let projectId: string | null = null;
    if (knowledge.project_name) {
      const existing = await getProjectByName(knowledge.project_name);
      projectId = existing?.id || projectMap.get(knowledge.project_name.toLowerCase()) || null;
    }

    // Generate embedding for the knowledge chunk
    let embedding: number[] | null = null;
    try {
      embedding = await generateEmbedding(knowledge.content);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
    }

    await addProjectKnowledge({
      project_id: projectId,
      content: knowledge.content,
      embedding,
      source_type: 'meeting' as KnowledgeSource,
      source_id: sourceId,
    });

    knowledgeAdded++;
  }

  return {
    tasksCreated,
    knowledgeAdded,
    projectsCreated,
  };
}

/**
 * Generate a summary of extracted data for user confirmation
 */
export function generateTranscriptSummary(result: TranscriptProcessingResult): string {
  const parts: string[] = [];

  if (result.new_projects.length > 0) {
    parts.push(`New projects to create: ${result.new_projects.map(p => p.name).join(', ')}`);
  }

  if (result.tasks.length > 0) {
    parts.push(`Tasks to create (${result.tasks.length}):`);
    result.tasks.slice(0, 5).forEach(t => {
      const project = t.project_name ? ` [${t.project_name}]` : '';
      parts.push(`  - ${t.description}${project}`);
    });
    if (result.tasks.length > 5) {
      parts.push(`  ... and ${result.tasks.length - 5} more`);
    }
  }

  if (result.knowledge.length > 0) {
    parts.push(`Knowledge chunks to store: ${result.knowledge.length}`);
  }

  if (parts.length === 0) {
    return 'Nothing to extract from this transcript.';
  }

  return parts.join('\n');
}
