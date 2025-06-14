import { supabase, fetchCalendarEventTagsForEventIds } from './supabaseClient'; 

// --- Helper Function to get Access Token (Specific to Calendar, might be consolidated later) ---
const getCalendarAccessToken = async (): Promise<string | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Error getting Supabase session:', sessionError);
    return null;
  }
  // Log session data to inspect provider_token presence
  console.log('getCalendarAccessToken: Supabase session data:', session);
  // Ensure the provider_token exists and potentially check if calendar scopes were granted
  if (!session?.provider_token) {
    console.error('No provider_token found in session. User might need to re-authenticate with Calendar scope.');
    throw new Error('Google API token expired'); // Throw the specific error message
  }
  return session.provider_token;
};

// --- Google Calendar API Base URL ---
const GOOGLE_CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3';

// --- Interfaces for Google Calendar Event Resource ---
// Define Tag type locally or import if shared
interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface GoogleCalendarEventDateTime {
  dateTime?: string; // Format: '2023-12-31T14:00:00-07:00' (RFC3339)
  date?: string;     // Format: '2023-12-31' (for all-day events)
  timeZone?: string; // e.g., 'America/Los_Angeles'
}

export interface GoogleCalendarEventInput {
  summary?: string;
  description?: string;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
}

export interface GoogleCalendarEvent extends GoogleCalendarEventInput {
  id: string;
  status?: string; 
  htmlLink?: string;
  created?: string;
  updated?: string;
  tags?: Tag[]; 
}

// --- API Client Functions ---

/**
 * @param calendarId - The calendar identifier (usually 'primary').
 * @param timeMin - Start time (ISO string).
 * @param timeMax - End time (ISO string).
 * @returns Promise resolving to an array of GoogleCalendarEvent objects.
 */
export const fetchCalendarEvents = async (
  userId: string, // Add userId parameter
  calendarId: string = 'primary',
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> => {
  // getCalendarAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getCalendarAccessToken();
  // The catch block in the calling component will handle the error.
  if (!userId) {
      console.error("User ID is required to fetch calendar events with tags.");
      throw new Error('User ID is required.'); // Or return empty array?
  }

  const params = new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: 'true', // Expand recurring events into single instances
    orderBy: 'startTime',
  });

  const url = `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

  // Log the parameters being sent to Google API for debugging
  console.log(`Fetching Google Calendar events: URL=${url}, AccessToken=${accessToken ? 'Exists' : 'Missing'}`);
  console.log(`Params: timeMin=${timeMin}, timeMax=${timeMax}`);


  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Failed to fetch calendar events: ${response.status}`, errorBody);
      throw new Error(`Failed to fetch events: ${errorBody?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    let events: GoogleCalendarEvent[] = data.items || []; // Events are in the 'items' array

    // --- Fetch and Merge Tags ---
    if (events.length > 0) {
        const eventIds = events.map(event => event.id);
        try {
            const tagsMap = await fetchCalendarEventTagsForEventIds(userId, eventIds);
            // Merge tags into events
            events = events.map(event => ({
                ...event,
                tags: tagsMap.get(event.id) || [] // Add tags array, default to empty
            }));
        } catch (tagError) {
            console.error("Error fetching or merging calendar event tags:", tagError);
            // Decide how to handle: return events without tags or re-throw?
            // Returning without tags is more robust for the UI.
             events = events.map(event => ({
                ...event,
                tags: [] // Ensure tags property exists even on error
            }));
        }
    }

    return events;

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error; // Re-throw for the caller to handle
  }
};

/**
 * Fetches events specifically for today from the primary calendar.
 * @returns Promise resolving to an array of today's GoogleCalendarEvent objects.
 */
export const fetchTodaysCalendarEvents = async (userId: string): Promise<GoogleCalendarEvent[]> => { // Add userId
  // getCalendarAccessToken is called within fetchCalendarEvents,
  // so no explicit check needed here.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0); // Set to beginning of today

  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999); // Set to end of today

  // Convert to ISO strings required by the API
  const timeMin = todayStart.toISOString();
  const timeMax = todayEnd.toISOString();


  // Reuse the existing fetchCalendarEvents function
  return fetchCalendarEvents(userId, 'primary', timeMin, timeMax); 
};

/**
 * Creates a new event on the specified calendar.
 * @param calendarId - The calendar identifier (usually 'primary').
 * @param eventData - The event data matching GoogleCalendarEventInput.
 * @returns Promise resolving to the created GoogleCalendarEvent object.
 */
export const createCalendarEvent = async (
  calendarId: string = 'primary',
  eventData: GoogleCalendarEventInput
): Promise<GoogleCalendarEvent> => {
   // getCalendarAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getCalendarAccessToken();
  // The catch block in the calling component will handle the error.

  const url = `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events`;

  // Log accessToken presence before the fetch call
  console.log(`createCalendarEvent: Using access token: ${accessToken ? 'Present' : 'Missing'}`);
  console.log('createCalendarEvent: Event data:', eventData);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
       // Log the specific status and error body on failure
       const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
       console.error(`Failed to create calendar event: Status=${response.status}`, errorBody);
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      throw new Error(`Failed to create event: ${errorBody?.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
};

/**
 * Updates an existing calendar event.
 * @param calendarId - The calendar identifier (usually 'primary').
 * @param eventId - The ID of the event to update.
 * @param eventData - The updated event data.
 * @returns Promise resolving to the updated GoogleCalendarEvent object.
 */
export const updateCalendarEvent = async (
  calendarId: string = 'primary',
  eventId: string,
  eventData: GoogleCalendarEventInput
): Promise<GoogleCalendarEvent> => {
   // getCalendarAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getCalendarAccessToken();
  // The catch block in the calling component will handle the error.

  const url = `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  // Log accessToken presence before the fetch call
  console.log(`updateCalendarEvent: Using access token: ${accessToken ? 'Present' : 'Missing'}`);
  console.log('updateCalendarEvent: Event ID:', eventId, 'Event data:', eventData);

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
       // Log the specific status and error body on failure
       const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
       console.error(`Failed to update calendar event ${eventId}: Status=${response.status}`, errorBody);
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      throw new Error(`Failed to update event: ${errorBody?.error?.message || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error updating calendar event ${eventId}:`, error);
    throw error;
  }
};

/**
 * Deletes a calendar event.
 * @param calendarId - The calendar identifier (usually 'primary').
 * @param eventId - The ID of the event to delete.
 * @returns Promise resolving when the deletion is successful.
 */
export const deleteCalendarEvent = async (
  calendarId: string = 'primary',
  eventId: string
): Promise<void> => {
  // getCalendarAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getCalendarAccessToken();
  // The catch block in the calling component will handle the error.

  const url = `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // DELETE returns 204 No Content on success
    if (!response.ok && response.status !== 204) {
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Failed to delete calendar event ${eventId}: ${response.status}`, errorBody);
      throw new Error(`Failed to delete event: ${errorBody?.error?.message || response.statusText}`);
    }
    // No body content expected on successful delete (204)

  } catch (error) {
    console.error(`Error deleting calendar event ${eventId}:`, error);
    throw error;
  }
};

// --- Timeline Function ---
import { TimelineEvent } from './supabaseClient';

/**
 * Fetches recent calendar event activity (creations, updates, cancellations).
 * @param calendarId - The calendar identifier (usually 'primary').
 * @param limit - Maximum number of events to fetch.
 * @returns Promise resolving to an array of TimelineEvent objects.
 */
export const fetchRecentCalendarActivity = async (
    calendarId: string = 'primary',
    limit: number = 20
): Promise<TimelineEvent[]> => {
    // getCalendarAccessToken now throws an error if token is not available,
    // so we don't need the explicit check here.
    const accessToken = await getCalendarAccessToken();
    // The catch block in the calling component will handle the error.

    const params = new URLSearchParams({
        maxResults: limit.toString(),
        orderBy: 'updated', // Order by last modification time
        showDeleted: 'true', // Include cancelled/deleted events
        // timeMin could be added here to limit how far back we look, e.g., last 7 days
        // timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const url = `${GOOGLE_CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
             if (response.status === 401 || response.status === 403) {
                throw new Error('Google API token expired');
            }
            const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
            console.error(`Failed to fetch recent calendar activity: ${response.status}`, errorBody);
            // Decide whether to throw or return empty
            return [];
            // throw new Error(`Failed to fetch calendar activity: ${errorBody?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const events: GoogleCalendarEvent[] = data.items || [];

        // Process events into TimelineEvent format
        const timelineEvents: TimelineEvent[] = events.map(event => {
            let eventType: TimelineEvent['type'];
            let timestamp: string;

            if (event.status === 'cancelled') {
                eventType = 'CALENDAR_EVENT_DELETED'; // Treat cancelled as deleted for timeline
                timestamp = event.updated || new Date().toISOString(); // Use updated time for cancellation
            } else if (event.created && event.updated && new Date(event.updated).getTime() - new Date(event.created).getTime() < 5000) {
                // If created and updated are very close, consider it CREATED
                eventType = 'CALENDAR_EVENT_CREATED';
                timestamp = event.created;
            } else if (event.updated) {
                // Otherwise, consider it UPDATED
                eventType = 'CALENDAR_EVENT_UPDATED';
                timestamp = event.updated;
            } else {
                 console.warn("Could not determine calendar event type:", event);
                 return null; // Skip if we can't determine type/timestamp
            }


            return {
                id: `cal-${event.id}-${timestamp}`, // Create a unique ID including timestamp
                type: eventType,
                timestamp: timestamp,
                data: {
                    eventId: event.id,
                    eventSummary: event.summary || '(No Title)',
                    htmlLink: event.htmlLink // Include link to view event in Google Calendar
                }
            };
        }).filter(event => event !== null); // Filter out nulls, removed problematic type predicate

        // Explicitly sort by timestamp descending to ensure correct order
        timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return timelineEvents;

    } catch (error) {
        console.error('Error fetching recent calendar activity:', error);
        // Decide whether to throw or return empty
        return [];
        // throw error;
    }
};
