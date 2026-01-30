import type { CalendarEvent } from '@/lib/utils/types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN!;

let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get a valid access token, refreshing if needed
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedAccessToken && Date.now() < tokenExpiry - 60000) {
    return cachedAccessToken;
  }

  // Refresh the token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Google token: ${error}`);
  }

  const data = await response.json();
  const token: string = data.access_token;
  cachedAccessToken = token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return token;
}

/**
 * Call Google Calendar API
 */
async function callCalendarApi(endpoint: string, params?: Record<string, string>): Promise<unknown> {
  const accessToken = await getAccessToken();

  const url = new URL(`https://www.googleapis.com/calendar/v3${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar API error: ${error}`);
  }

  return response.json();
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}

interface CalendarEventsResponse {
  items: GoogleCalendarEvent[];
}

/**
 * Get calendar events for today (Pacific time)
 */
export async function getTodaysEvents(): Promise<CalendarEvent[]> {
  // Get start and end of today in Pacific time
  const now = new Date();
  const pacificOffset = -8 * 60; // PST offset in minutes
  const localOffset = now.getTimezoneOffset();
  const pacificTime = new Date(now.getTime() + (localOffset - pacificOffset) * 60000);

  const startOfDay = new Date(pacificTime);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(pacificTime);
  endOfDay.setHours(23, 59, 59, 999);

  const data = await callCalendarApi('/calendars/primary/events', {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  }) as CalendarEventsResponse;

  return (data.items || []).map(event => ({
    id: event.id,
    summary: event.summary || 'No title',
    start: event.start.dateTime || event.start.date || '',
    end: event.end.dateTime || event.end.date || '',
    location: event.location,
  }));
}

/**
 * Get calendar events for the next N days
 */
export async function getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);

  const data = await callCalendarApi('/calendars/primary/events', {
    timeMin: now.toISOString(),
    timeMax: futureDate.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  }) as CalendarEventsResponse;

  return (data.items || []).map(event => ({
    id: event.id,
    summary: event.summary || 'No title',
    start: event.start.dateTime || event.start.date || '',
    end: event.end.dateTime || event.end.date || '',
    location: event.location,
  }));
}

/**
 * Format calendar event for display
 */
export function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.start);
  const hours = start.getHours();
  const minutes = start.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');

  return `${displayHours}:${displayMinutes}${ampm}`;
}

/**
 * Format events list for display in a message
 */
export function formatEventsForMessage(events: CalendarEvent[]): string {
  if (events.length === 0) {
    return 'No calendar events today.';
  }

  return events.map(event => {
    const time = formatEventTime(event);
    const location = event.location ? ` at ${event.location}` : '';
    return `${time} ${event.summary}${location}`;
  }).join('\n');
}
