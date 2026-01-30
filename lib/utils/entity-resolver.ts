import type { Project, Task, ActiveContext, ResolvedEntities } from '@/lib/utils/types';
import { getAllProjects, getAllTasks, getProjectById, getTaskById } from '@/lib/db/queries';

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score (0-1, higher is better)
 */
export function similarityScore(query: string, candidate: string): number {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();

  // Exact match
  if (q === c) return 1;

  // Contains match
  if (c.includes(q)) return 0.9;
  if (q.includes(c)) return 0.85;

  // Levenshtein similarity
  const maxLen = Math.max(q.length, c.length);
  const distance = levenshteinDistance(q, c);
  const levenSimilarity = 1 - (distance / maxLen);

  return levenSimilarity;
}

interface MatchResult<T> {
  item: T;
  score: number;
}

/**
 * Find best matches for a query string among candidates
 */
function findBestMatches<T>(
  query: string,
  candidates: T[],
  getLabel: (item: T) => string,
  threshold: number = 0.5
): MatchResult<T>[] {
  const matches: MatchResult<T>[] = [];

  for (const candidate of candidates) {
    const label = getLabel(candidate);
    const score = similarityScore(query, label);

    if (score >= threshold) {
      matches.push({ item: candidate, score });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Resolve a project reference to actual project(s)
 * Returns array of matches - caller decides what to do with multiple matches
 */
export async function resolveProjectReference(
  reference: string,
  context: ActiveContext
): Promise<Project[]> {
  // Check if it's a contextual reference like "that project" or "this project"
  const contextualRefs = ['that project', 'this project', 'the project', 'it'];
  if (contextualRefs.some(ref => reference.toLowerCase().includes(ref))) {
    if (context.current_project_id) {
      const project = await getProjectById(context.current_project_id);
      if (project) return [project];
    }

    // Try recently mentioned projects
    for (const projectId of context.recently_mentioned_projects) {
      const project = await getProjectById(projectId);
      if (project) return [project];
    }

    return [];
  }

  // Get all projects and find matches
  const allProjects = await getAllProjects();

  // Boost recently mentioned projects
  const matches = findBestMatches(reference, allProjects, p => p.name, 0.4);

  // Boost recently mentioned in scores
  for (const match of matches) {
    if (context.recently_mentioned_projects.includes(match.item.id)) {
      match.score += 0.2; // Boost by 20%
    }
  }

  // Re-sort after boosting
  matches.sort((a, b) => b.score - a.score);

  // Return top matches (high confidence match returns single, otherwise multiple for disambiguation)
  if (matches.length === 0) return [];

  if (matches[0].score >= 0.9) {
    return [matches[0].item];
  }

  // If top match is clearly better than second, return just top
  if (matches.length === 1 || matches[0].score - matches[1].score > 0.2) {
    return [matches[0].item];
  }

  // Return top 3 for disambiguation
  return matches.slice(0, 3).map(m => m.item);
}

/**
 * Resolve a task reference to actual task(s)
 */
export async function resolveTaskReference(
  reference: string,
  context: ActiveContext,
  projectId?: string
): Promise<Task[]> {
  // Check contextual references
  const contextualRefs = ['that task', 'this task', 'the task', 'it', 'that', 'this one'];
  if (contextualRefs.some(ref => reference.toLowerCase().includes(ref))) {
    if (context.current_task_id) {
      const task = await getTaskById(context.current_task_id);
      if (task) return [task];
    }

    // Try recently mentioned tasks
    for (const taskId of context.recently_mentioned_tasks) {
      const task = await getTaskById(taskId);
      if (task) return [task];
    }

    return [];
  }

  // Get all tasks (optionally filtered by project)
  const allTasks = await getAllTasks();
  const filteredTasks = projectId
    ? allTasks.filter(t => t.project_id === projectId)
    : allTasks;

  const matches = findBestMatches(reference, filteredTasks, t => t.description, 0.4);

  // Boost recently mentioned
  for (const match of matches) {
    if (context.recently_mentioned_tasks.includes(match.item.id)) {
      match.score += 0.2;
    }
  }

  matches.sort((a, b) => b.score - a.score);

  if (matches.length === 0) return [];

  if (matches[0].score >= 0.9) {
    return [matches[0].item];
  }

  if (matches.length === 1 || matches[0].score - matches[1].score > 0.2) {
    return [matches[0].item];
  }

  return matches.slice(0, 3).map(m => m.item);
}

/**
 * Resolve all entity references from a router result
 */
export async function resolveEntities(
  projectRefs: string[],
  taskRefs: string[],
  context: ActiveContext
): Promise<ResolvedEntities> {
  const result: ResolvedEntities = {
    projects: [],
    tasks: [],
  };

  // Resolve projects
  for (const ref of projectRefs) {
    const matches = await resolveProjectReference(ref, context);
    for (const project of matches) {
      if (!result.projects.find(p => p.id === project.id)) {
        result.projects.push({ name: project.name, id: project.id });
      }
    }
  }

  // Resolve tasks (use resolved project ID if available)
  const projectId = result.projects[0]?.id;
  for (const ref of taskRefs) {
    const matches = await resolveTaskReference(ref, context, projectId);
    for (const task of matches) {
      if (!result.tasks.find(t => t.id === task.id)) {
        result.tasks.push({ description: task.description, id: task.id });
      }
    }
  }

  return result;
}

/**
 * Check if an entity reference suggests creating a new entity
 */
export function suggestsNewEntity(reference: string): boolean {
  const newIndicators = ['new', 'create', 'add', 'start', 'starting'];
  const lower = reference.toLowerCase();
  return newIndicators.some(ind => lower.includes(ind));
}

/**
 * Extract potential project name from natural language
 */
export function extractProjectName(text: string): string | null {
  // Look for patterns like "the Johnson deck" or "Chen project"
  const patterns = [
    /(?:the|a)\s+([A-Z][a-z]+(?:\s+[a-z]+)?)\s+(?:project|job|deck|remodel|kitchen|bathroom)/i,
    /([A-Z][a-z]+)\s+(?:project|job|site)/i,
    /(?:at|for)\s+([A-Z][a-z]+(?:'s)?)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}
