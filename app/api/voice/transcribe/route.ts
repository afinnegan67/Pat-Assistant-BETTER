import { NextRequest, NextResponse } from 'next/server';
import { saveVoiceTranscript, savePendingApproval } from '@/lib/db/queries';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { processTranscript, generateTranscriptSummary } from '@/lib/agents/transcript';
import { sendMessage } from '@/lib/services/telegram';

const AIDAN_TELEGRAM_ID = process.env.AIDAN_TELEGRAM_ID!;

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

async function transcribeAudio(audioBuffer: Buffer): Promise<{ text: string; duration: number }> {
  console.log('Sending to ElevenLabs, buffer size:', audioBuffer.length);

  // Convert Buffer to Uint8Array for Blob compatibility
  const audioBlob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/webm' });

  const result = await elevenlabs.speechToText.convert({
    file: audioBlob,
    modelId: 'scribe_v2',
  });

  // Handle the union response type - extract text from the appropriate field
  let transcriptText: string;
  if ('text' in result) {
    // SpeechToTextChunkResponseModel (single channel)
    transcriptText = result.text;
  } else if ('transcripts' in result && result.transcripts.length > 0) {
    // MultichannelSpeechToTextResponseModel - combine all channel transcripts
    transcriptText = result.transcripts.map(t => t.text).join(' ');
  } else {
    throw new Error('Unexpected response format from ElevenLabs');
  }

  // Estimate duration from text length (rough approximation: ~150 words per minute)
  const wordCount = transcriptText.split(/\s+/).length;
  const estimatedDuration = Math.round((wordCount / 150) * 60);

  return {
    text: transcriptText,
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

    // Transcribe with ElevenLabs
    console.log('Starting ElevenLabs transcription...');
    const { text: transcriptText, duration: estimatedDuration } = await transcribeAudio(audioBuffer);
    console.log('Transcription complete, text length:', transcriptText.length);

    // Use provided duration or estimate
    const durationSeconds = durationStr ? parseInt(durationStr, 10) : estimatedDuration;

    // Save raw transcript to database
    console.log('Saving transcript to database...');
    const transcript = await saveVoiceTranscript({
      raw_content: transcriptText,
      duration_seconds: durationSeconds,
      source: 'webapp',
    });
    console.log('Transcript saved, ID:', transcript.id);

    // Process the transcript to extract tasks, knowledge, and projects
    console.log('Processing transcript with AI...');
    const processingResult = await processTranscript(transcriptText, 'webapp');
    console.log('Processing complete:', JSON.stringify(processingResult, null, 2));

    // Check if there's anything to save
    const hasContent = processingResult.tasks.length > 0 ||
                       processingResult.knowledge.length > 0 ||
                       processingResult.new_projects.length > 0;

    if (!hasContent) {
      console.log('No tasks, knowledge, or projects extracted');
      await sendMessage(AIDAN_TELEGRAM_ID, 'Processed your voice note but found nothing to extract. Was it just casual conversation?');
      return NextResponse.json({
        success: true,
        transcriptId: transcript.id,
        summary: 'Nothing to extract from this recording.',
        tasksCreated: 0,
        needsConfirmation: false,
      });
    }

    // Save pending approval and notify Patrick
    console.log('Saving pending approval...');
    await savePendingApproval(transcript.id, processingResult);

    // Generate summary and send for approval
    const summary = generateTranscriptSummary(processingResult);
    console.log('Sending approval request to Aidan...');
    await sendMessage(AIDAN_TELEGRAM_ID, `Voice note processed:\n\n${summary}\n\nLooks good? Reply "yes" to save, "no" to discard, or tell me what to change.`);

    return NextResponse.json({
      success: true,
      transcriptId: transcript.id,
      summary,
      tasksCreated: processingResult.tasks.length,
      needsConfirmation: true,
    });

  } catch (error) {
    console.error('=== VOICE TRANSCRIBE ERROR ===');
    console.error('Error type:', (error as Error).constructor.name);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);

    return NextResponse.json(
      { error: 'Transcription failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}
