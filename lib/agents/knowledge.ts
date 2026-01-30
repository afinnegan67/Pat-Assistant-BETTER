import { generateText } from 'ai';
import { smartModel } from '@/lib/services/ai-provider';
import type {
  AgentContext,
  KnowledgeAgentResult,
  ProjectKnowledge,
} from '@/lib/utils/types';
import { searchKnowledgeByText } from '@/lib/db/embeddings';
import { getProjectKnowledge, getProjectById } from '@/lib/db/queries';

const KNOWLEDGE_SYSTEM_PROMPT = `You are the knowledge retrieval agent for Patrick's construction assistant. You answer questions about projects using semantic search over stored knowledge.

You have access to:
- Project knowledge chunks (decisions, notes, context from meetings)
- Project details
- Task history

When answering:
- Search for relevant knowledge using the query
- Synthesize information from multiple chunks if needed
- Be specific - cite what was decided and when if available
- If you don't have the information, say so directly

Be matter-of-fact and blunt. No fluff.`;

function formatKnowledgeChunks(chunks: ProjectKnowledge[]): string {
  if (chunks.length === 0) {
    return 'No relevant knowledge found in the database.';
  }

  return chunks.map((chunk, i) => {
    const date = new Date(chunk.created_at).toLocaleDateString();
    return `[${i + 1}] (${date}, ${chunk.source_type}): ${chunk.content}`;
  }).join('\n\n');
}

/**
 * Handle knowledge query intents
 */
export async function handleKnowledgeQuery(context: AgentContext): Promise<KnowledgeAgentResult> {
  try {
    // Get project ID if we have one
    const projectId = context.resolvedEntities.projects[0]?.id
      || context.activeContext.current_project_id;

    // Search for relevant knowledge
    let knowledgeChunks: ProjectKnowledge[] = [];

    // Try semantic search first
    try {
      knowledgeChunks = await searchKnowledgeByText(
        context.userMessage,
        projectId,
        5
      );
    } catch (error) {
      console.error('Semantic search failed:', error);

      // Fall back to project-specific knowledge if we have a project
      if (projectId) {
        knowledgeChunks = await getProjectKnowledge(projectId);
      }
    }

    // Get project details if available
    let projectContext = '';
    if (projectId) {
      const project = await getProjectById(projectId);
      if (project) {
        projectContext = `\nProject: ${project.name}
Status: ${project.status}
Client: ${project.client_name || 'Unknown'}
Type: ${project.project_type || 'Not specified'}
Address: ${project.address || 'Not specified'}`;
      }
    }

    // Generate answer using LLM
    const { text: answer } = await generateText({
      model: smartModel,
      system: KNOWLEDGE_SYSTEM_PROMPT,
      prompt: `Patrick asked: "${context.userMessage}"
${projectContext}

Relevant knowledge from the database:
${formatKnowledgeChunks(knowledgeChunks)}

Based on this information, answer Patrick's question. If the information isn't available, say so directly.`,
    });

    // Determine confidence based on knowledge found
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (knowledgeChunks.length >= 3) {
      confidence = 'high';
    } else if (knowledgeChunks.length >= 1) {
      confidence = 'medium';
    }

    return {
      answer: answer.trim(),
      sources: knowledgeChunks.map(chunk => ({
        content: chunk.content,
        created_at: chunk.created_at,
      })),
      confidence,
    };
  } catch (error) {
    console.error('Knowledge agent error:', error);
    return {
      answer: 'Your nephew Aidan failed to build me correctly. Blame him not me.',
      sources: [],
      confidence: 'low',
    };
  }
}

/**
 * Handle project status queries specifically
 */
export async function handleProjectQuery(context: AgentContext): Promise<KnowledgeAgentResult> {
  const projectId = context.resolvedEntities.projects[0]?.id
    || context.activeContext.current_project_id;

  if (!projectId) {
    return {
      answer: 'Which project are you asking about?',
      sources: [],
      confidence: 'low',
    };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return {
      answer: 'Project not found.',
      sources: [],
      confidence: 'low',
    };
  }

  // Get recent knowledge for the project
  const knowledgeChunks = await getProjectKnowledge(projectId);
  const recentKnowledge = knowledgeChunks.slice(0, 5);

  const statusSummary = `${project.name} is ${project.status}.
Client: ${project.client_name || 'Unknown'}
Type: ${project.project_type || 'Not specified'}
Address: ${project.address || 'Not specified'}`;

  if (recentKnowledge.length > 0) {
    const recentNotes = recentKnowledge
      .map(k => `- ${k.content}`)
      .join('\n');

    return {
      answer: `${statusSummary}\n\nRecent notes:\n${recentNotes}`,
      sources: recentKnowledge.map(k => ({
        content: k.content,
        created_at: k.created_at,
      })),
      confidence: 'high',
    };
  }

  return {
    answer: statusSummary,
    sources: [],
    confidence: 'high',
  };
}
