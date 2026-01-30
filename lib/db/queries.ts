import { supabase } from './supabase';
import type {
  Project,
  Task,
  Message,
  Conversation,
  ProjectKnowledge,
  VoiceTranscript,
  DailyBrief,
  ActiveContext,
  ProjectStatus,
  TaskStatus,
  TaskPriority,
  KnowledgeSource,
} from '@/lib/utils/types';

// ============ CONVERSATIONS ============

export async function getOrCreateConversation(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation');
  if (error) throw new Error(`Failed to get/create conversation: ${error.message}`);
  return data as string;
}

export async function closeOldConversations(): Promise<void> {
  const { error } = await supabase.rpc('close_old_conversations');
  if (error) throw new Error(`Failed to close old conversations: ${error.message}`);
}

// ============ MESSAGES ============

export async function getTodaysMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get messages: ${error.message}`);
  return data as Message[];
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  activeContext: ActiveContext
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      active_context: activeContext,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Update conversation last_activity
  await supabase
    .from('conversations')
    .update({ last_activity: new Date().toISOString() })
    .eq('id', conversationId);

  return data as Message;
}

export async function getLastMessageContext(conversationId: string): Promise<ActiveContext | null> {
  const { data, error } = await supabase
    .from('messages')
    .select('active_context')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.active_context as ActiveContext;
}

// ============ TASKS ============

export async function createTask(task: {
  description: string;
  project_id?: string | null;
  deadline?: string | null;
  priority?: TaskPriority;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
}): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      description: task.description,
      project_id: task.project_id || null,
      deadline: task.deadline || null,
      priority: task.priority || 'medium',
      is_recurring: task.is_recurring || false,
      recurrence_rule: task.recurrence_rule || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as Task;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'description' | 'priority' | 'deadline' | 'status' | 'project_id'>>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as Task;
}

export async function completeTask(taskId: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete task: ${error.message}`);
  return data as Task;
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) return null;
  return data as Task;
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get tasks: ${error.message}`);
  return data as Task[];
}

export async function getPendingTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('deadline', { ascending: true });

  if (error) throw new Error(`Failed to get pending tasks: ${error.message}`);
  return data as Task[];
}

export async function getOverdueTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .lt('deadline', new Date().toISOString())
    .order('deadline', { ascending: true });

  if (error) throw new Error(`Failed to get overdue tasks: ${error.message}`);
  return data as Task[];
}

export async function getTodaysTasks(): Promise<Task[]> {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .gte('deadline', startOfDay)
    .lte('deadline', endOfDay)
    .order('priority', { ascending: false });

  if (error) throw new Error(`Failed to get today's tasks: ${error.message}`);
  return data as Task[];
}

export async function getTasksNeedingReminder(): Promise<Task[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'pending')
    .lt('deadline', new Date().toISOString())
    .or(`last_reminded_at.is.null,last_reminded_at.lt.${oneDayAgo}`)
    .order('deadline', { ascending: true });

  if (error) throw new Error(`Failed to get tasks needing reminder: ${error.message}`);
  return data as Task[];
}

export async function updateTaskReminder(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({ last_reminded_at: new Date().toISOString() })
    .eq('id', taskId);

  if (error) throw new Error(`Failed to update task reminder: ${error.message}`);
}

export async function searchTasks(query: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .ilike('description', `%${query}%`)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Failed to search tasks: ${error.message}`);
  return data as Task[];
}

export async function getAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get all tasks: ${error.message}`);
  return data as Task[];
}

// ============ PROJECTS ============

export async function createProject(project: {
  name: string;
  client_name?: string | null;
  address?: string | null;
  project_type?: string | null;
  status?: ProjectStatus;
}): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: project.name,
      client_name: project.client_name || null,
      address: project.address || null,
      project_type: project.project_type || null,
      status: project.status || 'future',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'name' | 'client_name' | 'address' | 'project_type' | 'status'>>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return data as Project;
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) return null;
  return data as Project;
}

export async function getProjectByName(name: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .ilike('name', name)
    .limit(1)
    .single();

  if (error) return null;
  return data as Project;
}

export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return data as Project[];
}

export async function getActiveProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to get active projects: ${error.message}`);
  return data as Project[];
}

export async function searchProjects(query: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .or(`name.ilike.%${query}%,client_name.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Failed to search projects: ${error.message}`);
  return data as Project[];
}

// ============ PROJECT KNOWLEDGE ============

export async function addProjectKnowledge(knowledge: {
  project_id?: string | null;
  content: string;
  embedding: number[] | null;
  source_type: KnowledgeSource;
  source_id?: string | null;
}): Promise<ProjectKnowledge> {
  const { data, error } = await supabase
    .from('project_knowledge')
    .insert({
      project_id: knowledge.project_id || null,
      content: knowledge.content,
      embedding: knowledge.embedding,
      source_type: knowledge.source_type,
      source_id: knowledge.source_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to add knowledge: ${error.message}`);
  return data as ProjectKnowledge;
}

export async function getProjectKnowledge(projectId: string): Promise<ProjectKnowledge[]> {
  const { data, error } = await supabase
    .from('project_knowledge')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get project knowledge: ${error.message}`);
  return data as ProjectKnowledge[];
}

// ============ VOICE TRANSCRIPTS ============

export async function saveVoiceTranscript(transcript: {
  raw_content: string;
  duration_seconds?: number | null;
  source: 'telegram' | 'webapp';
}): Promise<VoiceTranscript> {
  const { data, error } = await supabase
    .from('voice_transcripts')
    .insert({
      raw_content: transcript.raw_content,
      duration_seconds: transcript.duration_seconds || null,
      source: transcript.source,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save transcript: ${error.message}`);
  return data as VoiceTranscript;
}

export async function updateTranscriptProcessed(
  transcriptId: string,
  summary: string
): Promise<void> {
  const { error } = await supabase
    .from('voice_transcripts')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      processing_summary: summary,
    })
    .eq('id', transcriptId);

  if (error) throw new Error(`Failed to update transcript: ${error.message}`);
}

// ============ DAILY BRIEFS ============

export async function saveDailyBrief(brief: {
  brief_date: string;
  content: string;
  tasks_included: string[];
}): Promise<DailyBrief> {
  const { data, error } = await supabase
    .from('daily_briefs')
    .insert({
      brief_date: brief.brief_date,
      content: brief.content,
      tasks_included: brief.tasks_included,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save daily brief: ${error.message}`);
  return data as DailyBrief;
}

export async function getTodaysBrief(): Promise<DailyBrief | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_briefs')
    .select('*')
    .eq('brief_date', today)
    .single();

  if (error) return null;
  return data as DailyBrief;
}
