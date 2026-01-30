const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const PATRICK_TELEGRAM_ID = process.env.PATRICK_TELEGRAM_ID!;

interface TelegramApiResponse {
  ok: boolean;
  result?: unknown;
  description?: string;
}

async function callTelegramApi(
  method: string,
  body?: Record<string, unknown>,
  retries: number = 5
): Promise<unknown> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add timeout using AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: TelegramApiResponse = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      return data.result;
    } catch (error) {
      lastError = error as Error;
      console.error(`Telegram API attempt ${attempt + 1}/${retries} failed:`, error);

      if (attempt < retries - 1) {
        // Exponential backoff: 1s, 2s, 4s, 8s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to call Telegram API after retries');
}

/**
 * Send a text message to a chat
 */
export async function sendMessage(chatId: string | number, text: string): Promise<void> {
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  });
}

/**
 * Send a message to Patrick specifically
 */
export async function sendMessageToPatrick(text: string): Promise<void> {
  await sendMessage(PATRICK_TELEGRAM_ID, text);
}

/**
 * Show typing indicator in a chat
 */
export async function sendTypingAction(chatId: string | number): Promise<void> {
  await callTelegramApi('sendChatAction', {
    chat_id: chatId,
    action: 'typing',
  });
}

/**
 * Get file info from Telegram to download it
 */
export async function getFile(fileId: string): Promise<{ file_path: string }> {
  const result = await callTelegramApi('getFile', { file_id: fileId });
  return result as { file_path: string };
}

/**
 * Download a voice note by file ID and return as Buffer
 */
export async function downloadVoiceNote(fileId: string): Promise<Buffer> {
  // Get file path from Telegram
  const fileInfo = await getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

  // Download the file
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download voice note: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Set webhook URL for receiving updates
 */
export async function setWebhook(url: string, secretToken?: string): Promise<void> {
  await callTelegramApi('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message'],
  });
}

/**
 * Delete webhook (for local development)
 */
export async function deleteWebhook(): Promise<void> {
  await callTelegramApi('deleteWebhook');
}

/**
 * Verify that the webhook secret matches
 */
export function verifyWebhookSecret(
  providedSecret: string | null,
  expectedSecret: string
): boolean {
  return providedSecret === expectedSecret;
}

/**
 * Send an error message to Patrick blaming Aidan
 */
export async function sendErrorToPatrick(context: string): Promise<void> {
  const errorMessage = `Your nephew Aidan failed to build me correctly. Blame him not me.\n\nContext: ${context}`;
  await sendMessageToPatrick(errorMessage);
}
