// Database enum types (matching Supabase schema)
export type ProjectStatus = 'future' | 'active' | 'on_hold' | 'completed';
export type TaskStatus = 'pending' | 'completed' | 'on_hold' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type MessageRole = 'user' | 'assistant';
export type KnowledgeSource = 'meeting' | 'chat' | 'manual';

// Database row types
export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  project_type: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string | null;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  deadline: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  last_reminded_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Conversation {
  id: string;
  started_at: string;
  last_activity: string;
  conversation_date: string;
  is_active: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  active_context: ActiveContext;
  referenced_entities: ReferencedEntity[];
  created_at: string;
}

export interface ProjectKnowledge {
  id: string;
  project_id: string | null;
  content: string;
  embedding: number[] | null;
  source_type: KnowledgeSource;
  source_id: string | null;
  created_at: string;
}

export interface VoiceTranscript {
  id: string;
  raw_content: string;
  duration_seconds: number | null;
  source: 'telegram' | 'webapp';
  recorded_at: string;
  processed: boolean;
  processed_at: string | null;
  processing_summary: string | null;
}

export interface DailyBrief {
  id: string;
  brief_date: string;
  content: string;
  tasks_included: string[];
  sent_at: string;
}

// Context types
export interface ActiveContext {
  current_task_id?: string;
  current_project_id?: string;
  recently_mentioned_tasks: string[];
  recently_mentioned_projects: string[];
}

export interface ReferencedEntity {
  type: 'task' | 'project';
  id: string;
  name: string;
}

export interface ResolvedEntities {
  projects: { name: string; id: string }[];
  tasks: { description: string; id: string }[];
}

// Intent types
export type Intent =
  | 'task_create'
  | 'task_update'
  | 'task_complete'
  | 'task_query'
  | 'project_create'
  | 'project_update'
  | 'project_query'
  | 'schedule_query'
  | 'knowledge_query'
  | 'general_chat';

// Agent types
export interface AgentContext {
  intent: Intent;
  todaysMessages: Message[];
  activeContext: ActiveContext;
  resolvedEntities: ResolvedEntities;
  userMessage: string;
}

export interface RouterResult {
  intent: Intent;
  entities: {
    projects: string[];
    tasks: string[];
    deadline: string | null;
    priority: TaskPriority | null;
  };
  requires_lookup: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface TaskAgentResult {
  action: 'created' | 'updated' | 'completed' | 'queried';
  task: Task | null;
  tasks: Task[] | null;
  error: string | null;
}

export interface ProjectAgentResult {
  action: 'created' | 'updated';
  project: Project | null;
  error: string | null;
}

export interface KnowledgeAgentResult {
  answer: string;
  sources: { content: string; created_at: string }[];
  confidence: 'high' | 'medium' | 'low';
}

export interface TranscriptProcessingResult {
  tasks: {
    description: string;
    project_name: string | null;
    deadline: string | null;
    priority: TaskPriority | null;
  }[];
  knowledge: {
    project_name: string | null;
    content: string;
  }[];
  new_projects: {
    name: string;
    client_name: string | null;
    project_type: string | null;
  }[];
}

// Telegram types
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
  };
  date: number;
  text?: string;
  voice?: {
    file_id: string;
    duration: number;
  };
}

// Calendar types
export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string;
}

// Chat message type for LLM calls
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
