import { generateText } from 'ai';
import { fastModel } from '@/lib/services/ai-provider';
import type { Task, CalendarEvent } from '@/lib/utils/types';
import { getTodaysTasks, getOverdueTasks, getPendingTasks, getActiveProjects } from '@/lib/db/queries';
import { getTodaysEvents, formatEventsForMessage } from '@/lib/services/calendar';
import { getCurrentPSTDateTime } from '@/lib/utils/date-helpers';

function getBriefingSystemPrompt(): string {
  return `You generate Patrick's daily morning brief. You receive:

Current date and time: ${getCurrentPSTDateTime()}
- Today's tasks (with deadlines and priorities)
- Overdue tasks
- Today's calendar events
- Upcoming project milestones

Generate a concise morning brief that:
1. Leads with the most urgent items
2. Lists what's due today
3. Lists overdue items that need attention
4. Mentions any calendar events
5. Ends with a count summary

Keep it scannable. No fluff. Patrick is reading this at 6am before his day starts.

Example tone:
"Morning. 4 tasks due today, 2 overdue from last week.

Due today:
- Send Chen change order (high priority)
- Call inspector for Hubble
- Order materials for Johnson deck
- Submit receipts

Overdue:
- Return $600 item to Home Depot (3 days)
- Follow up with Manny on drywall (5 days)

Calendar: 9am client meeting at Chen site, 2pm admin meeting.

Total open tasks: 23 across 8 projects."`;
}

function formatTaskForBrief(task: Task): string {
  const parts = [task.description];

  if (task.priority === 'high' || task.priority === 'urgent') {
    parts.push(`(${task.priority} priority)`);
  }

  return parts.join(' ');
}

function formatOverdueTask(task: Task): string {
  if (!task.deadline) return task.description;

  const deadline = new Date(task.deadline);
  const now = new Date();
  const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

  return `${task.description} (${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue)`;
}

/**
 * Generate the daily morning brief
 */
export async function generateDailyBrief(): Promise<{
  content: string;
  taskIds: string[];
}> {
  try {
    // Gather all the data
    const [todaysTasks, overdueTasks, allPendingTasks, activeProjects, calendarEvents] = await Promise.all([
      getTodaysTasks(),
      getOverdueTasks(),
      getPendingTasks(),
      getActiveProjects(),
      getTodaysEvents().catch(() => [] as CalendarEvent[]),
    ]);

    // Format the data for the prompt
    const todaysTasksList = todaysTasks.length > 0
      ? todaysTasks.map(t => `- ${formatTaskForBrief(t)}`).join('\n')
      : 'No tasks due today.';

    const overdueList = overdueTasks.length > 0
      ? overdueTasks.map(t => `- ${formatOverdueTask(t)}`).join('\n')
      : 'No overdue tasks.';

    const calendarList = calendarEvents.length > 0
      ? formatEventsForMessage(calendarEvents)
      : 'No calendar events today.';

    const { text: content } = await generateText({
      model: fastModel,
      system: getBriefingSystemPrompt(),
      prompt: `Today's tasks (${todaysTasks.length}):
${todaysTasksList}

Overdue tasks (${overdueTasks.length}):
${overdueList}

Calendar events:
${calendarList}

Total open tasks: ${allPendingTasks.length}
Active projects: ${activeProjects.length}

Generate the morning brief.`,
    });

    // Collect all task IDs mentioned
    const taskIds = [
      ...todaysTasks.map(t => t.id),
      ...overdueTasks.map(t => t.id),
    ];

    return {
      content: content.trim(),
      taskIds,
    };
  } catch (error) {
    console.error('Briefing generation error:', error);
    return {
      content: 'Your nephew Aidan failed to build me correctly. Blame him not me.',
      taskIds: [],
    };
  }
}

/**
 * Generate a quick status summary (for ad-hoc requests)
 */
export async function generateQuickStatus(): Promise<string> {
  const [todaysTasks, overdueTasks, allPendingTasks] = await Promise.all([
    getTodaysTasks(),
    getOverdueTasks(),
    getPendingTasks(),
  ]);

  const urgent = allPendingTasks.filter(t => t.priority === 'urgent').length;
  const high = allPendingTasks.filter(t => t.priority === 'high').length;

  return `${todaysTasks.length} due today, ${overdueTasks.length} overdue, ${allPendingTasks.length} total open. ${urgent} urgent, ${high} high priority.`;
}
