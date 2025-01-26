import { supabase } from './supabaseClient';
import { CardTag } from './cardApi';
import { fetchCalendarEvents, GoogleCalendarEvent } from './googleCalendarClient';
import { fetchFullEmailDetails, GmailFullMessage, getHeaderValue } from './supabaseClient'; // Import email detail fetching

// Define placeholder types - these should ideally be imported from actual type definition files
// For now, defining basic structures based on schema and common patterns.

export interface Email {
  email_id: string; // Matches Supabase 'emails' table and Gmail ID
  user_id: string; // From Supabase 'emails' table
  thread_id?: string | null; // From Supabase 'emails' table
  is_starred?: boolean; // From Supabase 'emails' table
  created_at: string; // From Supabase 'emails' table (when added to DB)
  updated_at: string; // From Supabase 'emails' table (when updated in DB)
  // Details fetched from Gmail API
  subject?: string;
  snippet?: string;
  from?: string; // Extracted from headers
  date?: string; // Extracted from headers
}

// Use the imported GoogleCalendarEvent type directly
export type CalendarEvent = GoogleCalendarEvent;
// export interface CalendarEvent { // Added export - No longer needed, using imported type
//   // Structure depends heavily on the source (e.g., Google Calendar API)
//   id: string;
//   summary?: string | null;
//   description?: string | null; // Tags might be stored here?
//   start?: { dateTime?: string | null; date?: string | null } | null;
//   end?: { dateTime?: string | null; date?: string | null } | null;
//   // extendedProperties?: { private?: { [key: string]: string } }; // Or here?
//   tags?: CardTag[]; // How are tags associated? Needs investigation. - This is handled by googleCalendarClient
// }

export interface TimelineCustomCard { // Added export
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  start_date: string; // Date string
  end_date?: string | null; // Date string
  created_at: string;
  // We might want to fetch associated tags if needed in the component
  // tags?: CardTag[];
}

// Combined type for items displayed in the CustomCard (adjust as needed)
// type FilterableItem = Email | CalendarEvent | TimelineCustomCard;

export type FilterMode = 'any' | 'all';

/**
 * Fetches emails associated with the given tags based on the filter mode.
 * Uses the 'email_tags' junction table.
 * @param tagIds - An array of tag IDs to filter by.
 * @param mode - 'any' to match emails with at least one tag, 'all' to match emails with all tags.
 * @returns A promise that resolves to an array of matching emails.
 */
export const fetchEmailsByTags = async (tagIds: string[], mode: FilterMode): Promise<Email[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (tagIds.length === 0) return [];

    console.log(`Fetching emails for tags: ${tagIds.join(', ')}, mode: ${mode}`);

    try {
        // Step 1: Fetch email_ids matching the tags from Supabase
        let query = supabase
            .from('emails')
            .select(`
                email_id,
                user_id,
                thread_id,
                is_starred,
                created_at,
                updated_at,
                email_tags!inner(tag_id)
            `)
            .eq('user_id', user.id)
            .in('email_tags.tag_id', tagIds);

        const { data: emailsData, error: emailsError } = await query;

        if (emailsError) throw emailsError;
        if (!emailsData || emailsData.length === 0) return [];

        // Step 2: Filter based on 'any' or 'all' mode and get unique matching email IDs + base data
        const matchingEmailsMap = new Map<string, Email>();
        emailsData.forEach(email => {
            const baseEmailData = { // Extract base data, excluding join table info
                email_id: email.email_id,
                user_id: email.user_id,
                thread_id: email.thread_id,
                is_starred: email.is_starred,
                created_at: email.created_at,
                updated_at: email.updated_at,
            };

            if (mode === 'all') {
                // For 'all', check if this email already passed the check
                if (matchingEmailsMap.has(email.email_id)) return; // Already processed

                // Check if this email has all required tags by looking at all rows for this email_id
                const allTagsForThisEmail = emailsData
                    .filter(e => e.email_id === email.email_id)
                    .map(e => e.email_tags.map((et: any) => et.tag_id)) // Flatten tag IDs
                    .flat();
                const uniqueTagsForThisEmail = new Set(allTagsForThisEmail);

                if (tagIds.every(targetTagId => uniqueTagsForThisEmail.has(targetTagId))) {
                    matchingEmailsMap.set(email.email_id, baseEmailData);
                }
            } else { // mode === 'any'
                // For 'any', just add it if not already present
                if (!matchingEmailsMap.has(email.email_id)) {
                    matchingEmailsMap.set(email.email_id, baseEmailData);
                }
            }
        });

        const matchingEmailIds = Array.from(matchingEmailsMap.keys());
        if (matchingEmailIds.length === 0) return [];

        // Step 3: Fetch full details from Gmail API for the matching IDs
        const emailDetailsList = await fetchFullEmailDetails(matchingEmailIds);

        // Step 4: Create a map of details for easy lookup
        const detailsMap = emailDetailsList.reduce((acc, detail) => {
            acc[detail.id] = detail;
            return acc;
        }, {} as Record<string, GmailFullMessage>);

        // Step 5: Merge Supabase data with Gmail details
        const finalEmails: Email[] = [];
        matchingEmailsMap.forEach((baseData, emailId) => {
            const details = detailsMap[emailId];
            finalEmails.push({
                ...baseData, // Keep Supabase data like user_id, created_at, is_starred
                // Prioritize details from Gmail API response
                thread_id: details?.threadId || baseData.thread_id, // Use Gmail threadId first
                subject: details ? getHeaderValue(details.payload?.headers || [], 'Subject') : undefined,
                snippet: details?.snippet,
                from: details ? getHeaderValue(details.payload?.headers || [], 'From') : undefined,
                date: details ? getHeaderValue(details.payload?.headers || [], 'Date') : undefined,
            });
        });

        // Optional: Sort emails (e.g., by date, though date needs parsing)
        // finalEmails.sort((a, b) => /* Add sorting logic if needed */);

        return finalEmails;

    } catch (error) {
        console.error('Error fetching emails by tags:', error);
        throw error;
    }
};

/**
 * Fetches calendar events associated with the given tags based on the filter mode.
 * NOTE: Calendar events likely come from an external source (e.g., Google Calendar).
 * Tag association mechanism needs investigation (e.g., stored in description, extended properties, or separate mapping).
 * @param tagIds - An array of tag IDs to filter by.
 * @param mode - 'any' or 'all'.
 * @returns A promise that resolves to an array of matching calendar events.
 */
export const fetchCalendarEventsByTags = async (tagIds: string[], mode: FilterMode): Promise<CalendarEvent[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (tagIds.length === 0) return [];

    console.log(`Fetching calendar events for tags: ${tagIds.join(', ')}, mode: ${mode}`);

    try {
        // Define a time range for fetching events. Adjust as needed.
        // Example: From 1 month ago to 3 months in the future.
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1);
        const timeMax = new Date();
        timeMax.setMonth(timeMax.getMonth() + 3);

        // Fetch events using the client - this already includes merged tags
        const allRelevantEvents = await fetchCalendarEvents(
            user.id,
            'primary', // Assuming primary calendar
            timeMin.toISOString(),
            timeMax.toISOString()
        );

        // Filter these events client-side based on the tags and mode
        const filteredEvents = allRelevantEvents.filter(event => {
            // Ensure event.tags is an array and contains tag objects with 'id'
            const eventTagIds = new Set(
                (event.tags || [])
                .map(tag => tag?.id) // Get tag IDs
                .filter((id): id is string => !!id) // Filter out any undefined/null IDs
            );

            if (mode === 'all') {
                // Check if the event has *all* the required tag IDs
                return tagIds.every(targetTagId => eventTagIds.has(targetTagId));
            } else { // mode === 'any'
                // Check if the event has *at least one* of the required tag IDs
                return tagIds.some(targetTagId => eventTagIds.has(targetTagId));
            }
        });

        return filteredEvents;

    } catch (error) {
        console.error('Error fetching or filtering calendar events by tags:', error);
        // Don't return partial data, throw the error to be handled by the UI
        throw error;
    }
};

/**
 * Fetches Timeline Custom Cards associated with the given tags based on the filter mode.
 * Uses the 'timeline_card_tags' junction table.
 * @param tagIds - An array of tag IDs to filter by.
 * @param mode - 'any' or 'all'.
 * @returns A promise that resolves to an array of matching timeline custom cards.
 */
export const fetchTimelineCustomCardsByTags = async (tagIds: string[], mode: FilterMode): Promise<TimelineCustomCard[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (tagIds.length === 0) return [];

    console.log(`Fetching timeline custom cards for tags: ${tagIds.join(', ')}, mode: ${mode}`);

    try {
        let query = supabase
            .from('timeline_custom_cards')
            .select(`
                id,
                user_id,
                title,
                description,
                start_date,
                end_date,
                created_at,
                timeline_card_tags!inner(tag_id)
            `) // Use inner join
            .eq('user_id', user.id)
            .in('timeline_card_tags.tag_id', tagIds);

        if (mode === 'all') {
            // Similar to emails, 'all' mode is tricky client-side. RPC preferred.
            // Client-side filtering approach:
            const { data: cardsData, error: cardsError } = await query;

            if (cardsError) throw cardsError;
            if (!cardsData) return [];

            const filteredCards = cardsData.filter(card => {
                const associatedTagIds = Array.isArray(card.timeline_card_tags)
                    ? new Set(card.timeline_card_tags.map(tct => tct.tag_id))
                    : new Set<string>();
                return tagIds.every(targetTagId => associatedTagIds.has(targetTagId));
            });
            // Remove the join table data before returning
            return filteredCards.map(({ timeline_card_tags, ...rest }) => rest as TimelineCustomCard);

        } else { // mode === 'any'
            const { data: cardsData, error: cardsError } = await query;

            if (cardsError) throw cardsError;
            if (!cardsData) return [];

            // Deduplicate based on card id
            const uniqueCards = cardsData.reduce((acc, current) => {
                const { timeline_card_tags, ...cardData } = current;
                if (!acc[cardData.id]) {
                    acc[cardData.id] = cardData as TimelineCustomCard;
                }
                return acc;
            }, {} as Record<string, TimelineCustomCard>);

            return Object.values(uniqueCards);
        }

    } catch (error) {
        console.error('Error fetching timeline custom cards by tags:', error);
        throw error;
    }
};

// Note: The original request mentioned "Timeline custom cards" in the dropdown.
// If the "Timeline" dropdown needs to show *other* items (like logged card activities)
// based on the *CustomCard's* tags, that requires different logic.
// This implementation focuses on filtering the `timeline_custom_cards` table itself via its own tags.