import { NextRequest, NextResponse } from 'next/server';
import type { TelegramUpdate, TelegramMessage, AgentContext, Intent } from '@/lib/utils/types';
import { sendMessage, sendTypingAction, downloadVoiceNote, verifyWebhookSecret, sendErrorToPatrick } from '@/lib/services/telegram';
import { getOrCreateConversation, saveMessage } from '@/lib/db/queries';
import { loadActiveContext, loadTodaysMessages, mergeContext, updateContextWithNewTask, updateContextWithNewProject } from '@/lib/utils/context';
import { resolveEntities } from '@/lib/utils/entity-resolver';
import { routeMessage, needsSpecialist, getSpecialistAgent } from '@/lib/agents/router';
import { handleTaskIntent } from '@/lib/agents/task';
import { handleProjectIntent } from '@/lib/agents/project';
import { handleKnowledgeQuery, handleProjectQuery } from '@/lib/agents/knowledge';
import { generateResponse, generateGeneralChatResponse, generateDisambiguationResponse } from '@/lib/agents/response';
import { getTodaysTasks, getOverdueTasks } from '@/lib/db/queries';
import { getTodaysEvents } from '@/lib/services/calendar';

const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET!;
const PATRICK_TELEGRAM_ID = process.env.PATRICK_TELEGRAM_ID!;

// Eleven Labs transcription
async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer]), 'voice.ogg');
  formData.append('model_id', 'scribe_v1');

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
  return data.text;
}

async function processMessage(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from.id;

  // Only respond to Patrick
  if (userId.toString() !== PATRICK_TELEGRAM_ID) {
    await sendMessage(chatId, "I only talk to Patrick. If you're not Patrick, blame Aidan.");
    return;
  }

  let messageText = message.text || '';

  // Handle voice messages
  if (message.voice) {
    try {
      await sendTypingAction(chatId);

      // Download and transcribe
      const audioBuffer = await downloadVoiceNote(message.voice.file_id);
      messageText = await transcribeAudio(audioBuffer);

      // Acknowledge transcription
      await sendMessage(chatId, `Heard: "${messageText.slice(0, 100)}${messageText.length > 100 ? '...' : ''}"`);
    } catch (error) {
      console.error('Voice processing error:', error);
      await sendErrorToPatrick('Voice message processing');
      return;
    }
  }

  if (!messageText.trim()) {
    return;
  }

  try {
    // Show typing indicator
    await sendTypingAction(chatId);

    // Get or create today's conversation
    const conversationId = await getOrCreateConversation();

    // Load context
    const [activeContext, todaysMessages] = await Promise.all([
      loadActiveContext(conversationId),
      loadTodaysMessages(conversationId),
    ]);

    // Save user message
    await saveMessage(conversationId, 'user', messageText, activeContext);

    // Route the message
    const routerResult = await routeMessage(messageText, todaysMessages, activeContext);

    // If requires lookup, send typing again
    if (routerResult.requires_lookup) {
      await sendTypingAction(chatId);
    }

    // Resolve entities from router result
    const resolvedEntities = await resolveEntities(
      routerResult.entities.projects,
      routerResult.entities.tasks,
      activeContext
    );

    // Check for disambiguation needed
    if (resolvedEntities.projects.length > 1 && routerResult.entities.projects.length === 1) {
      const response = generateDisambiguationResponse('project', resolvedEntities.projects);
      await sendMessage(chatId, response);
      await saveMessage(conversationId, 'assistant', response, activeContext);
      return;
    }

    if (resolvedEntities.tasks.length > 1 && routerResult.entities.tasks.length === 1) {
      const response = generateDisambiguationResponse('task', resolvedEntities.tasks);
      await sendMessage(chatId, response);
      await saveMessage(conversationId, 'assistant', response, activeContext);
      return;
    }

    // Build agent context
    const agentContext: AgentContext = {
      intent: routerResult.intent,
      todaysMessages,
      activeContext,
      resolvedEntities,
      userMessage: messageText,
    };

    let response: string;
    let updatedContext = activeContext;

    // Route to specialist or generate direct response
    if (!needsSpecialist(routerResult.intent)) {
      response = await generateGeneralChatResponse(messageText, todaysMessages);
    } else {
      const specialist = getSpecialistAgent(routerResult.intent);

      switch (specialist) {
        case 'task':
          const taskResult = await handleTaskIntent(agentContext);
          response = await generateResponse({
            intent: routerResult.intent,
            userMessage: messageText,
            todaysMessages,
            result: taskResult,
          });

          // Update context if task was created
          if (taskResult.action === 'created' && taskResult.task) {
            updatedContext = updateContextWithNewTask(activeContext, taskResult.task.id);
          }
          break;

        case 'project':
          const projectResult = await handleProjectIntent(agentContext);
          response = await generateResponse({
            intent: routerResult.intent,
            userMessage: messageText,
            todaysMessages,
            result: projectResult,
          });

          // Update context if project was created
          if (projectResult.action === 'created' && projectResult.project) {
            updatedContext = updateContextWithNewProject(activeContext, projectResult.project.id);
          }
          break;

        case 'knowledge':
          const knowledgeResult = routerResult.intent === 'project_query'
            ? await handleProjectQuery(agentContext)
            : await handleKnowledgeQuery(agentContext);
          response = await generateResponse({
            intent: routerResult.intent,
            userMessage: messageText,
            todaysMessages,
            result: knowledgeResult,
          });
          break;

        case 'schedule':
          // Combine tasks and calendar events
          const [tasks, overdue, events] = await Promise.all([
            getTodaysTasks(),
            getOverdueTasks(),
            getTodaysEvents().catch(() => []),
          ]);
          response = await generateResponse({
            intent: routerResult.intent,
            userMessage: messageText,
            todaysMessages,
            tasks: [...tasks, ...overdue],
            events,
          });
          break;

        default:
          response = await generateGeneralChatResponse(messageText, todaysMessages);
      }
    }

    // Merge resolved entities into context
    updatedContext = mergeContext(updatedContext, resolvedEntities);

    // Send response
    await sendMessage(chatId, response);

    // Save assistant response
    await saveMessage(conversationId, 'assistant', response, updatedContext);

  } catch (error) {
    console.error('Message processing error:', error);
    await sendErrorToPatrick('Message processing');
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
    if (!verifyWebhookSecret(secretHeader, TELEGRAM_WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: TelegramUpdate = await request.json();

    // Handle message updates
    if (update.message) {
      // Process in background to avoid timeout
      processMessage(update.message).catch(error => {
        console.error('Background message processing error:', error);
      });
    }

    // Telegram expects 200 OK quickly
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET endpoint for webhook verification
export async function GET() {
  return NextResponse.json({ status: 'Webhook active' });
}
