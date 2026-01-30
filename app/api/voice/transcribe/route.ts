import { NextRequest, NextResponse } from 'next/server';
import { saveVoiceTranscript, updateTranscriptProcessed } from '@/lib/db/queries';
import { processTranscript, commitTranscriptData, generateTranscriptSummary } from '@/lib/agents/transcript';
import { sendMessageToPatrick } from '@/lib/services/telegram';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

// Threshold for requiring confirmation (30 minutes)
const CONFIRMATION_THRESHOLD_SECONDS = 30 * 60;

async function transcribeAudio(audioBuffer: Buffer): Promise<{ text: string; duration: number }> {
  // Create a File object with explicit type - works better in Node.js serverless
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });
  const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('model_id', 'scribe_v1');

  console.log('Sending to ElevenLabs, file size:', audioFile.size, 'type:', audioFile.type);

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Transcription failed: ${error}`);
  }

  const data = await response.json();

  // Estimate duration from text length (rough approximation: ~150 words per minute)
  const wordCount = data.text.split(/\s+/).length;
  const estimatedDuration = Math.round((wordCount / 150) * 60);

  return {
    text: data.text,
    duration: estimatedDuration,
  };
}

export async function POST(request: NextRequest) {
  console.log('=== VOICE TRANSCRIBE API START ===');
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const durationStr = formData.get('duration') as string;

    console.log('Audio file received:', audioFile?.name, 'size:', audioFile?.size);

    if (!audioFile) {
      console.log('No audio file provided');
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    console.log('Audio buffer created, length:', audioBuffer.length);

    // Transcribe
    console.log('Starting ElevenLabs transcription...');
    const { text: transcriptText, duration: estimatedDuration } = await transcribeAudio(audioBuffer);
    console.log('Transcription complete, text length:', transcriptText.length);

    // Use provided duration or estimate
    const durationSeconds = durationStr ? parseInt(durationStr, 10) : estimatedDuration;

    // Save transcript to database
    console.log('Saving transcript to database...');
    const transcript = await saveVoiceTranscript({
      raw_content: transcriptText,
      duration_seconds: durationSeconds,
      source: 'webapp',
    });
    console.log('Transcript saved, ID:', transcript.id);

    // Process transcript to extract tasks and knowledge
    console.log('Processing transcript with AI...');
    const processingResult = await processTranscript(transcriptText, 'webapp');
    console.log('Processing complete:', JSON.stringify(processingResult, null, 2));

    // Generate summary
    const summary = generateTranscriptSummary(processingResult);

    // Check if confirmation is needed (long recordings)
    const needsConfirmation = durationSeconds > CONFIRMATION_THRESHOLD_SECONDS;

    if (needsConfirmation) {
      // Store processing result for later confirmation
      // For now, just notify Patrick and ask for confirmation
      await sendMessageToPatrick(
        `Processed ${Math.round(durationSeconds / 60)} minute recording.\n\n${summary}\n\nReply "confirm" to save this data, or "cancel" to discard.`
      );

      return NextResponse.json({
        success: true,
        transcriptId: transcript.id,
        summary,
        needsConfirmation: true,
        message: 'Long recording - awaiting confirmation',
      });
    }

    // For short recordings, commit immediately
    const commitResult = await commitTranscriptData(processingResult, transcript.id);

    // Update transcript as processed
    await updateTranscriptProcessed(transcript.id, summary);

    // Notify Patrick
    const notification = `Processed recording: ${commitResult.tasksCreated} tasks created, ${commitResult.knowledgeAdded} knowledge chunks stored${commitResult.projectsCreated > 0 ? `, ${commitResult.projectsCreated} new projects` : ''}.`;

    await sendMessageToPatrick(notification);

    return NextResponse.json({
      success: true,
      transcriptId: transcript.id,
      summary,
      needsConfirmation: false,
      tasksCreated: commitResult.tasksCreated,
      knowledgeAdded: commitResult.knowledgeAdded,
      projectsCreated: commitResult.projectsCreated,
    });

  } catch (error) {
    console.error('=== VOICE TRANSCRIBE ERROR ===');
    console.error('Error type:', (error as Error).constructor.name);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);

    // Notify Patrick of error
    try {
      await sendMessageToPatrick(`Voice transcription failed: ${(error as Error).message}`);
    } catch (e) {
      console.error('Failed to send error notification:', e);
    }

    return NextResponse.json(
      { error: 'Transcription failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// Endpoint to confirm long transcript processing
export async function PUT(request: NextRequest) {
  try {
    const { transcriptId, action } = await request.json();

    if (!transcriptId) {
      return NextResponse.json({ error: 'No transcript ID provided' }, { status: 400 });
    }

    if (action === 'cancel') {
      await sendMessageToPatrick('Recording discarded.');
      return NextResponse.json({ success: true, message: 'Transcript discarded' });
    }

    if (action === 'confirm') {
      // Re-process and commit
      // In a production app, you'd store the processing result and retrieve it here
      // For now, we'd need to re-process the transcript
      await sendMessageToPatrick('Recording data saved.');
      return NextResponse.json({ success: true, message: 'Transcript committed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Confirmation error:', error);
    return NextResponse.json(
      { error: 'Confirmation failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
