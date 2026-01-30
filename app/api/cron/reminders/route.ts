import { NextRequest, NextResponse } from 'next/server';
import { generateReminders } from '@/lib/agents/reminder';
import { sendMessageToPatrick } from '@/lib/services/telegram';

// Vercel cron authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if set (for Vercel cron jobs)
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Generate reminders
    const { reminders, taskIds } = await generateReminders();

    // If no reminders needed, just return
    if (reminders.length === 0) {
      return NextResponse.json({
        success: true,
        remindersSent: 0,
        message: 'No reminders needed',
      });
    }

    // Send each reminder to Patrick
    for (const reminder of reminders) {
      await sendMessageToPatrick(reminder);
    }

    return NextResponse.json({
      success: true,
      remindersSent: reminders.length,
      tasksReminded: taskIds.length,
    });

  } catch (error) {
    console.error('Reminders error:', error);

    // Try to notify Patrick of error
    try {
      await sendMessageToPatrick('Your nephew Aidan failed to build me correctly. Blame him not me. (Reminders failed)');
    } catch (e) {
      console.error('Failed to send error notification:', e);
    }

    return NextResponse.json(
      { error: 'Reminders failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
