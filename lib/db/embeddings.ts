import { supabase } from './supabase';
import type { ProjectKnowledge } from '@/lib/utils/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const EMBEDDING_MODEL = 'openai/text-embedding-3-small';

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.APP_URL || 'https://patricks-assistant.vercel.app',
      'X-Title': 'Patricks Assistant',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate embedding: ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function searchKnowledgeByEmbedding(
  embedding: number[],
  limit: number = 5,
  projectId?: string
): Promise<ProjectKnowledge[]> {
  // Use Supabase's vector similarity search with pgvector
  // This requires a function in Supabase that does the cosine similarity search
  let query = supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
  });

  const { data, error } = await query;

  if (error) {
    // If the RPC function doesn't exist yet, fall back to simple query
    console.error('Vector search failed, falling back to simple query:', error.message);
    return searchKnowledgeFallback(projectId, limit);
  }

  return data as ProjectKnowledge[];
}

async function searchKnowledgeFallback(
  projectId?: string,
  limit: number = 5
): Promise<ProjectKnowledge[]> {
  let query = supabase
    .from('project_knowledge')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to search knowledge: ${error.message}`);
  return data as ProjectKnowledge[];
}

export async function searchKnowledgeByText(
  query: string,
  projectId?: string,
  limit: number = 5
): Promise<ProjectKnowledge[]> {
  try {
    // Generate embedding for the query
    const embedding = await generateEmbedding(query);

    // Search by embedding similarity
    return await searchKnowledgeByEmbedding(embedding, limit, projectId);
  } catch (error) {
    console.error('Embedding search failed:', error);
    // Fall back to text search
    return searchKnowledgeFallback(projectId, limit);
  }
}

// SQL function to add to Supabase for vector similarity search:
/*
create or replace function match_knowledge(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  project_id uuid,
  content text,
  embedding vector(1536),
  source_type knowledge_source,
  source_id uuid,
  created_at timestamptz,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    pk.id,
    pk.project_id,
    pk.content,
    pk.embedding,
    pk.source_type,
    pk.source_id,
    pk.created_at,
    1 - (pk.embedding <=> query_embedding) as similarity
  from project_knowledge pk
  where pk.embedding is not null
    and 1 - (pk.embedding <=> query_embedding) > match_threshold
  order by pk.embedding <=> query_embedding
  limit match_count;
end;
$$;
*/
