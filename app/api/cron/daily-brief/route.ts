import { NextRequest, NextResponse } from 'next/server';
import { generateDailyBrief } from '@/lib/agents/briefing';
import { sendMessageToPatrick } from '@/lib/services/telegram';
import { closeOldConversations, saveDailyBrief } from '@/lib/db/queries';

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

    // Close yesterday's conversations
    await closeOldConversations();

    // Generate the daily brief
    const { content, taskIds } = await generateDailyBrief();

    // Save to database
    const today = new Date().toISOString().split('T')[0];
    try {
      await saveDailyBrief({
        brief_date: today,
        content,
        tasks_included: taskIds,
      });
    } catch (error) {
      // Brief might already exist for today (e.g., manual trigger)
      console.log('Brief may already exist for today:', error);
    }

    // Send to Patrick via Telegram
    await sendMessageToPatrick(content);

    return NextResponse.json({
      success: true,
      date: today,
      tasksIncluded: taskIds.length,
    });

  } catch (error) {
    console.error('Daily brief error:', error);

    // Try to notify Patrick of error
    try {
      await sendMessageToPatrick('Your nephew Aidan failed to build me correctly. Blame him not me. (Daily brief failed)');
    } catch (e) {
      console.error('Failed to send error notification:', e);
    }

    return NextResponse.json(
      { error: 'Daily brief failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST endpoint for manual trigger
export async function POST(request: NextRequest) {
  return GET(request);
}
