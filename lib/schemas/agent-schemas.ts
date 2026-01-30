import { z } from 'zod';

// ============ Common Schemas ============

export const IntentSchema = z.enum([
  'task_create',
  'task_update',
  'task_complete',
  'task_query',
  'project_create',
  'project_update',
  'project_query',
  'schedule_query',
  'knowledge_query',
  'general_chat',
]);

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const TaskStatusSchema = z.enum(['pending', 'completed', 'on_hold', 'cancelled']);

export const ProjectStatusSchema = z.enum(['future', 'active', 'on_hold', 'completed']);

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

// ============ Router Agent Schema ============

export const RouterResultSchema = z.object({
  intent: IntentSchema,
  entities: z.object({
    projects: z.array(z.string()).default([]),
    tasks: z.array(z.string()).default([]),
    deadline: z.string().nullable().default(null),
    priority: TaskPrioritySchema.nullable().default(null),
  }),
  requires_lookup: z.boolean().default(false),
  confidence: ConfidenceSchema.default('medium'),
});

export type RouterResultOutput = z.infer<typeof RouterResultSchema>;

// ============ Task Agent Schema ============

export const TaskActionSchema = z.enum(['create', 'update', 'complete', 'query']);
export const QueryTypeSchema = z.enum(['all', 'project', 'overdue', 'today', 'search']);

export const TaskAgentResponseSchema = z.object({
  action: TaskActionSchema,
  task_description: z.string().optional(),
  task_id: z.string().optional(),
  project_id: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: TaskPrioritySchema.nullable().optional(),
  updates: z.object({
    description: z.string().optional(),
    priority: TaskPrioritySchema.optional(),
    deadline: z.string().optional(),
    status: TaskStatusSchema.optional(),
  }).optional(),
  query_type: QueryTypeSchema.optional(),
  search_term: z.string().optional(),
});

export type TaskAgentResponseOutput = z.infer<typeof TaskAgentResponseSchema>;

// ============ Project Agent Schema ============

export const ProjectActionSchema = z.enum(['create', 'update']);

export const ProjectAgentResponseSchema = z.object({
  action: ProjectActionSchema,
  name: z.string().optional(),
  project_id: z.string().optional(),
  client_name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  project_type: z.string().nullable().optional(),
  status: ProjectStatusSchema.nullable().optional(),
});

export type ProjectAgentResponseOutput = z.infer<typeof ProjectAgentResponseSchema>;

// ============ Transcript Agent Schema ============

export const ExtractedTaskSchema = z.object({
  description: z.string(),
  project_name: z.string().nullable().default(null),
  deadline: z.string().nullable().default(null),
  priority: TaskPrioritySchema.nullable().default(null),
});

export const ExtractedKnowledgeSchema = z.object({
  project_name: z.string().nullable().default(null),
  content: z.string(),
});

export const ExtractedProjectSchema = z.object({
  name: z.string(),
  client_name: z.string().nullable().default(null),
  project_type: z.string().nullable().default(null),
});

export const TranscriptResultSchema = z.object({
  tasks: z.array(ExtractedTaskSchema).default([]),
  knowledge: z.array(ExtractedKnowledgeSchema).default([]),
  new_projects: z.array(ExtractedProjectSchema).default([]),
});

export type TranscriptResultOutput = z.infer<typeof TranscriptResultSchema>;
