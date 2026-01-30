import type { Task, ChatMessage } from '@/lib/utils/types';
import { callFastModel } from '@/lib/services/openrouter';
import { getTasksNeedingReminder, updateTaskReminder, getProjectById } from '@/lib/db/queries';

const REMINDER_SYSTEM_PROMPT = `You generate proactive reminders for Patrick. You check for:
- Tasks overdue by 1+ days (remind daily)
- Recurring tasks that are due
- Project events coming up within reminder window

Generate contextual, useful reminders. Not robotic pings.

For overdue tasks: "The Home Depot return is 3 days overdue. That's $600 sitting in the truck."

For upcoming project events: "Johnson deck kicks off in 5 days. Have you lined up subs? Want me to draft the client email?"

Be direct. Create urgency where appropriate. Offer to help where the system can help.

Generate a single reminder message that covers the most important items. Keep it under 3-4 sentences unless there are many urgent items.`;

function formatTaskForReminder(task: Task): string {
  const parts = [`"${task.description}"`];

  if (task.deadline) {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 0) {
      parts.push(`(${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue)`);
    }
  }

  if (task.priority === 'urgent') {
    parts.push('[URGENT]');
  } else if (task.priority === 'high') {
    parts.push('[high priority]');
  }

  return parts.join(' ');
}

/**
 * Generate reminders for overdue tasks
 */
export async function generateReminders(): Promise<{
  reminders: string[];
  taskIds: string[];
}> {
  try {
    // Get tasks that need reminding
    const tasksNeedingReminder = await getTasksNeedingReminder();

    if (tasksNeedingReminder.length === 0) {
      return {
        reminders: [],
        taskIds: [],
      };
    }

    // Group by urgency
    const urgent = tasksNeedingReminder.filter(t => t.priority === 'urgent');
    const high = tasksNeedingReminder.filter(t => t.priority === 'high');
    const other = tasksNeedingReminder.filter(t => t.priority !== 'urgent' && t.priority !== 'high');

    // Build context for the LLM
    const tasksList = [
      ...urgent.map(t => `URGENT: ${formatTaskForReminder(t)}`),
      ...high.map(t => `HIGH: ${formatTaskForReminder(t)}`),
      ...other.slice(0, 5).map(t => formatTaskForReminder(t)),
    ].join('\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: REMINDER_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Tasks needing attention (${tasksNeedingReminder.length} total):
${tasksList}

Generate a reminder message for Patrick. Be direct and create appropriate urgency.`,
      },
    ];

    const reminder = await callFastModel(messages);

    // Update last_reminded_at for all tasks we're reminding about
    const taskIds = tasksNeedingReminder.map(t => t.id);
    await Promise.all(taskIds.map(id => updateTaskReminder(id)));

    return {
      reminders: [reminder.trim()],
      taskIds,
    };
  } catch (error) {
    console.error('Reminder generation error:', error);
    return {
      reminders: [],
      taskIds: [],
    };
  }
}

/**
 * Generate a single reminder for a specific task
 */
export async function generateTaskReminder(task: Task): Promise<string> {
  // Get project context if available
  let projectContext = '';
  if (task.project_id) {
    const project = await getProjectById(task.project_id);
    if (project) {
      projectContext = ` (${project.name} project)`;
    }
  }

  // Calculate days overdue
  let overdueContext = '';
  if (task.deadline) {
    const deadline = new Date(task.deadline);
    const now = new Date();
    const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 0) {
      overdueContext = ` This is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.`;
    }
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: REMINDER_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Task: "${task.description}"${projectContext}
Priority: ${task.priority}${overdueContext}

Generate a brief, direct reminder for this specific task.`,
    },
  ];

  try {
    const reminder = await callFastModel(messages);
    return reminder.trim();
  } catch (error) {
    console.error('Task reminder error:', error);
    return `Reminder: ${task.description}${overdueContext}`;
  }
}

/**
 * Check if reminders should be sent (based on time of day)
 * Reminders are sent at 11am, 3pm, and 7pm PST
 */
export function shouldSendReminders(): boolean {
  const now = new Date();
  const pstHour = (now.getUTCHours() - 8 + 24) % 24; // Convert to PST

  // Check if we're within the reminder windows (with 30 min tolerance)
  const reminderHours = [11, 15, 19]; // 11am, 3pm, 7pm PST

  for (const hour of reminderHours) {
    if (pstHour === hour || (pstHour === hour - 1 && now.getMinutes() >= 30)) {
      return true;
    }
  }

  return false;
}
