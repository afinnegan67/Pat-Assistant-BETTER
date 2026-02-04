import { NextRequest, NextResponse } from 'next/server';
import { processTranscript, generateTranscriptSummary } from '@/lib/agents/transcript';
import { getVoiceTranscript, savePendingApproval } from '@/lib/db/queries';
import { sendMessage } from '@/lib/services/telegram';

const AIDAN_TELEGRAM_ID = process.env.AIDAN_TELEGRAM_ID!;
const PATRICK_TELEGRAM_ID = process.env.PATRICK_TELEGRAM_ID!;

const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET;

/**
 * This endpoint is called by a Supabase trigger when a new voice transcript is inserted.
 * It processes the transcript with AI to extract tasks/knowledge, then sends to Telegram for approval.
 */
export async function POST(request: NextRequest) {
  console.log('=== PROCESS TRANSCRIPT START ===');

  try {
    // Debug: Log all headers
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = key.toLowerCase().includes('secret') ? `${value.substring(0, 10)}...(len:${value.length})` : value;
    });
    console.log('Incoming headers:', JSON.stringify(allHeaders, null, 2));
    console.log('Expected secret configured:', !!SUPABASE_WEBHOOK_SECRET);
    if (SUPABASE_WEBHOOK_SECRET) {
      console.log('Expected secret preview:', `${SUPABASE_WEBHOOK_SECRET.substring(0, 10)}...(len:${SUPABASE_WEBHOOK_SECRET.length})`);
    }

    // Verify request is from Supabase (if secret is configured)
    if (SUPABASE_WEBHOOK_SECRET) {
      const authHeader = request.headers.get('x-supabase-webhook-secret');
      console.log('Auth header received:', authHeader ? `${authHeader.substring(0, 10)}...(len:${authHeader.length})` : 'NULL');
      console.log('Secrets match:', authHeader === SUPABASE_WEBHOOK_SECRET);

      if (authHeader !== SUPABASE_WEBHOOK_SECRET) {
        console.error('Unauthorized: Invalid webhook secret');
        console.error('Expected:', SUPABASE_WEBHOOK_SECRET?.substring(0, 10));
        console.error('Received:', authHeader?.substring(0, 10));
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      console.log('No SUPABASE_WEBHOOK_SECRET configured - skipping auth check');
    }

    const body = await request.json();
    const transcriptId = body.transcript_id || body.record?.id;

    if (!transcriptId) {
      console.error('No transcript ID provided');
      return NextResponse.json({ error: 'No transcript ID provided' }, { status: 400 });
    }

    console.log('Processing transcript:', transcriptId);

    // Get the transcript from database
    const transcript = await getVoiceTranscript(transcriptId);
    if (!transcript) {
      console.error('Transcript not found:', transcriptId);
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    console.log('Transcript found, length:', transcript.raw_content.length);

    // Process with AI to extract tasks, knowledge, projects
    console.log('Processing with AI...');
    const processingResult = await processTranscript(transcript.raw_content, transcript.source);
    console.log('Processing complete:', JSON.stringify(processingResult, null, 2));

    // Generate human-readable summary
    const summary = generateTranscriptSummary(processingResult);

    // Store processing result for approval
    await savePendingApproval(transcriptId, processingResult);
    console.log('Pending approval saved');

    // Send to Telegram for human approval (natural language, no commands)
    const message = `Hey, just processed that recording. Here's what I got:\n\n${summary}\n\nDoes this look right?`;
    console.log('Attempting to send Telegram messages to both Aidan and Patrick...');
    console.log('Message preview:', message.substring(0, 200));

    // Send to both Aidan and Patrick
    try {
      await Promise.all([
        sendMessage(AIDAN_TELEGRAM_ID, message),
        sendMessage(PATRICK_TELEGRAM_ID, message),
      ]);
      console.log('Telegram notifications sent to both users');
    } catch (telegramError) {
      console.error('Telegram send FAILED:', telegramError);
      console.error('Telegram error details:', (telegramError as Error).message);
      // Don't throw - the processing still succeeded, just notification failed
    }

    return NextResponse.json({
      success: true,
      transcriptId,
      tasksFound: processingResult.tasks.length,
      knowledgeFound: processingResult.knowledge.length,
      projectsFound: processingResult.new_projects.length,
    });

  } catch (error) {
    console.error('=== PROCESS TRANSCRIPT ERROR ===');
    console.error('Error:', error);

    // Try to notify both of the error
    try {
      const errorMsg = `Had trouble processing that recording: ${(error as Error).message}`;
      await Promise.all([
        sendMessage(AIDAN_TELEGRAM_ID, errorMsg),
        sendMessage(PATRICK_TELEGRAM_ID, errorMsg),
      ]);
    } catch (e) {
      console.error('Failed to send error notification:', e);
    }

    return NextResponse.json(
      { error: 'Processing failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
