import { NextRequest, NextResponse } from 'next/server';
import { saveVoiceTranscript } from '@/lib/db/queries';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

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
    // Supabase trigger will handle AI processing and Telegram notification
    console.log('Saving transcript to database...');
    const transcript = await saveVoiceTranscript({
      raw_content: transcriptText,
      duration_seconds: durationSeconds,
      source: 'webapp',
    });
    console.log('Transcript saved, ID:', transcript.id);
    console.log('Supabase trigger will process asynchronously');

    // Return immediately - processing happens via Supabase trigger
    return NextResponse.json({
      success: true,
      transcriptId: transcript.id,
      message: 'Recording saved. Processing in background - check Telegram for approval request.',
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
