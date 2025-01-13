import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not defined in environment variables.');
}

if (!supabaseKey) {
  throw new Error('VITE_SUPABASE_KEY is not defined in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helper Function to get Access Token ---
const getGmailAccessToken = async (): Promise<string | null> => {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error('Error getting Supabase session:', sessionError);
    return null;
  }
  console.log('Supabase session in getGmailAccessToken:', session);
  if (!session?.provider_token) {
    console.error('No provider_token found in session. User might need to re-authenticate with Gmail scope.');
    throw new Error('Google API token expired'); // Throw the specific error message
  }
  // Log the provider token (Google Access Token) - be cautious with logging full tokens in production
  console.log('Google Provider Token:', session.provider_token);
  // Log the Supabase Access Token (JWT) - we can potentially inspect this, but it's not the Google token
  console.log('Supabase Access Token:', session.access_token);
  // Log the scopes associated with the Supabase session (if available)
  return session.provider_token;
};

// --- Function to Mark an Email as Starred/Unstarred ---
export const markEmailStarred = async (userId: string, messageId: string, starred: boolean): Promise<boolean> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: starred ? ['STARRED'] : [],
        removeLabelIds: starred ? [] : ['STARRED']
      }),
    });

    if (!response.ok) {
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Failed to mark message ${messageId} as starred: ${response.status}`, errorBody);
      return false;
    }

    // Update Supabase to reflect the change
    const supabaseUpdateSuccess = await updateSupabaseEmail(userId, messageId, { is_starred: starred });
    if (!supabaseUpdateSuccess) {
      console.warn(`Failed to update Supabase after starring email ${messageId}. UI may be out of sync.`);
      // Consider reverting the Gmail change if Supabase update fails
    }

    console.log(`Message ${messageId} marked as ${starred ? 'starred' : 'unstarred'}.`);
    return true;

  } catch (error) {
    console.error(`Error marking message ${messageId} as starred:`, error);
    return false;
  }
};

// --- Renamed and Modified Function for Metadata ---
interface GmailMessageMetadata {
  id: string;
  threadId: string;
}

interface FetchEmailMetadataResult {
  messages: GmailMessageMetadata[];
  nextPageToken?: string;
}

export const fetchEmailMetadataPage = async (
  pageToken?: string | null,
  maxResults: number = 20
): Promise<FetchEmailMetadataResult> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.

  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }

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
      const errorBody = await response.text();
      console.error('Failed to fetch email metadata. Status:', response.status, 'Body:', errorBody);
      // Attempt to parse error for more details
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson?.error?.message) {
          throw new Error(`Failed to fetch email metadata: ${errorJson.error.message} (Status: ${response.status})`);
        }
      } catch (parseError) {
        // Ignore if parsing fails, use the original status
      }
      throw new Error(`Failed to fetch email metadata: ${response.status}`);
    }

    const data = await response.json();
    return {
      messages: data.messages || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error('Error fetching email metadata:', error);
    // Re-throw or handle more gracefully depending on desired UX
    throw error; // Re-throwing allows the caller (EmailsList) to handle it
  }
};


// --- Function to Fetch Important Email Metadata ---
export const fetchImportantEmailMetadataPage = async (
  pageToken?: string | null,
  maxResults: number = 20
): Promise<FetchEmailMetadataResult> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.

  // Construct the URL with the IMPORTANT label filter
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=IMPORTANT`;
  if (pageToken) {
    url += `&pageToken=${pageToken}`;
  }

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
      const errorBody = await response.text();
      console.error('Failed to fetch important email metadata. Status:', response.status, 'Body:', errorBody);
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson?.error?.message) {
          throw new Error(`Failed to fetch important email metadata: ${errorJson.error.message} (Status: ${response.status})`);
        }
      } catch (parseError) {
        // Ignore if parsing fails
      }
      throw new Error(`Failed to fetch important email metadata: ${response.status}`);
    }

    const data = await response.json();
    return {
      messages: data.messages || [],
      nextPageToken: data.nextPageToken,
    };
  } catch (error) {
    console.error('Error fetching important email metadata:', error);
    throw error; // Re-throw for the caller to handle
  }
};

// --- Function to Search Gmail Messages ---
export interface SearchResult {
  messages: GmailMessageMetadata[]; // Reusing the metadata interface
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export const searchGmailMessages = async (
  query: string,
  maxResults: number = 50 // Limit results for initial search display
): Promise<SearchResult> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.
  if (!query) {
      // Or return empty result: return { messages: [], resultSizeEstimate: 0 };
      throw new Error('Search query cannot be empty.');
  }

  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;

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
      console.error(`Failed to search messages: ${response.status}`, errorBody);
      throw new Error(`Failed to search messages: ${errorBody?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      messages: data.messages || [], // Ensure messages is always an array
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
    };
  } catch (error) {
    console.error('Error searching Gmail messages:', error);
    throw error; // Re-throw for the caller to handle
  }
};

// --- New Function for Full Email Details ---
export interface GmailFullMessage { // Added export keyword
  id: string;
  threadId: string; // Add threadId here
  snippet: string;
  labelIds?: string[]; // Include labelIds to potentially check for UNREAD
  internalDate?: string; // Useful for more accurate sorting if needed
  payload?: GmailMessagePayload;
}

export const fetchFullEmailDetails = async (messageIds: string[]): Promise<GmailFullMessage[]> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  if (messageIds.length === 0) { // Still need to check for empty messageIds
    return [];
  }
  // The catch block in the calling component will handle the error from getGmailAccessToken.

  const requests = messageIds.map(id => {
    // Request snippet, specific headers, and labels (for read status)
    // Using format=metadata returns requested headers within payload.headers.
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
    return fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async res => { // Make inner function async to await text() on error
      if (!res.ok) {
         if (res.status === 401 || res.status === 403) {
            throw new Error('Google API token expired'); // Throw here to be caught by the outer catch
        }
        const errorBody = await res.text();
        console.error(`Failed to fetch details for email ${id}: ${res.status}`, errorBody);
        return null; // Handle individual failures gracefully
      }
      return res.json();
    }).catch(fetchError => { // Catch network errors for individual fetches
        console.error(`Network error fetching details for email ${id}:`, fetchError);
        return null;
    });
  });

  try {
    const results = await Promise.all(requests);
    console.log('Full email details results:', results);
    // Filter out null results from failed requests
    return results.filter((result): result is GmailFullMessage => result !== null);
  } catch (error) {
    // This catch might be less likely if individual fetches handle errors, but good practice
    console.error('Error fetching full email details in Promise.all:', error);
    return [];
  }
};

// --- Interface for Gmail Message Payload (when format=full) ---
interface GmailMessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: { name: string; value: string }[];
  body: {
    attachmentId?: string;
    size: number;
    data?: string; // base64url encoded
  };
  parts?: GmailMessagePart[];
}

interface GmailMessagePayload {
  partId: string;
  mimeType: string;
  filename: string;
  headers: { name: string; value: string }[];
  body: {
    size: number;
    data?: string; // base64url encoded (for simple text/plain or text/html)
  };
  parts?: GmailMessagePart[]; // For multipart messages
}

// --- Interface for Gmail Thread ---
// Note: This structure is based on users.threads.get response
export interface GmailThread {
  id: string;
  historyId: string;
  messages: GmailThreadMessage[]; // Messages within the thread
}

// Interface for a message specifically within a thread response
export interface GmailThreadMessage extends Omit<GmailFullMessage, 'payload'> {
  payload: GmailMessagePayload; // Use the detailed payload
}


// --- Function to Fetch a Full Email Thread ---
export const fetchEmailThread = async (threadId: string): Promise<GmailThread | null> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.

  // Request full format to get bodies, attachments etc.
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      const errorBody = await response.text();
      console.error(`Failed to fetch thread ${threadId}: ${response.status}`, errorBody);
      // Try to parse for a better error message
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson?.error?.message) {
          throw new Error(`Failed to fetch thread: ${errorJson.error.message} (Status: ${response.status})`);
        }
      } catch (parseError) { /* Ignore */ }
      throw new Error(`Failed to fetch thread: ${response.status}`);
    }

    const threadData: GmailThread = await response.json();
    // Sort messages by internalDate (oldest first)
    threadData.messages.sort((a, b) => parseInt(a.internalDate || '0') - parseInt(b.internalDate || '0'));
    return threadData;

  } catch (error) {
    console.error(`Error fetching thread ${threadId}:`, error);
    throw error; // Re-throw for the caller to handle
  }
};


// --- Function to Send a Reply ---
// Base64url encoding function
const base64UrlEncode = (str: string): string => {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

// Helper to get specific header value (Exported)
export const getHeaderValue = (headers: { name: string; value: string }[], name: string): string => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
};


export const sendReply = async (
    threadId: string,
    replyBody: string,
    originalMessage: GmailThreadMessage // Need the last message for headers
): Promise<GmailThreadMessage | null> => {
    // getGmailAccessToken now throws an error if token is not available,
    // so we don't need the explicit check here.
    const accessToken = await getGmailAccessToken();
    // The catch block in the calling component will handle the error.

    const originalHeaders = originalMessage.payload.headers;
    const to = getHeaderValue(originalHeaders, 'Reply-To') || getHeaderValue(originalHeaders, 'From');
    const subject = getHeaderValue(originalHeaders, 'Subject');
    const messageId = getHeaderValue(originalHeaders, 'Message-ID');
    const references = getHeaderValue(originalHeaders, 'References');

    // Construct the raw email message
    const emailLines = [
        `To: ${to}`,
        // Add CC/BCC if needed based on original message or UI input
        `Subject: Re: ${subject}`, // Simple "Re:" prefix
        `In-Reply-To: ${messageId}`,
        `References: ${references ? references + ' ' + messageId : messageId}`, // Append original Message-ID
        'Content-Type: text/plain; charset="UTF-8"', // Assuming plain text reply for simplicity
        '', // Empty line before body
        replyBody,
    ];
    const rawEmail = emailLines.join('\r\n');
    const encodedEmail = base64UrlEncode(rawEmail);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                raw: encodedEmail,
                threadId: threadId, // Ensure it's part of the thread
            }),
        });

        if (!response.ok) {
           if (response.status === 401 || response.status === 403) {
            throw new Error('Google API token expired');
          }
            const errorBody = await response.text();
            console.error(`Failed to send reply for thread ${threadId}: ${response.status}`, errorBody);
             try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson?.error?.message) {
                throw new Error(`Failed to send reply: ${errorJson.error.message} (Status: ${response.status})`);
                }
            } catch (parseError) { /* Ignore */ }
            throw new Error(`Failed to send reply: ${response.status}`);
        }

        const sentMessage: GmailThreadMessage = await response.json();

        // Fetch the full message details to get the payload
        const fullMessageUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${sentMessage.id}?format=full`;
        const fullMessageResponse = await fetch(fullMessageUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!fullMessageResponse.ok) {
            const errorBody = await fullMessageResponse.text();
            console.error(`Failed to fetch full message details for ${sentMessage.id}: ${fullMessageResponse.status}`, errorBody);
            // Consider returning null or a partial message object here
            return null;
        }

        const fullSentMessage: GmailThreadMessage = await fullMessageResponse.json();
        return fullSentMessage; // Return the *full* message details

    } catch (error) {
        console.error(`Error sending reply for thread ${threadId}:`, error);
        throw error; // Re-throw for the caller
    }
};

// --- Function to Send a New Email ---
export const sendNewGmailMessage = async (
    to: string, // Can be comma-separated for multiple recipients
    subject: string,
    body: string
): Promise<boolean> => { // Returns true on success, throws error on failure
    // getGmailAccessToken now throws an error if token is not available,
    // so we don't need the explicit check here.
    const accessToken = await getGmailAccessToken();
    // The catch block in the calling component will handle the error.

    // Construct the raw email message
    const emailLines = [
        `To: ${to}`,
        // Add CC/BCC headers here if needed in the future
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"', // Assuming plain text for simplicity
        '', // Empty line before body
        body,
    ];
    const rawEmail = emailLines.join('\r\n');

    // Reuse the existing base64UrlEncode helper
    const encodedEmail = base64UrlEncode(rawEmail);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                raw: encodedEmail,
                // Do not include threadId for new messages
            }),
        });

        if (!response.ok) {
           if (response.status === 401 || response.status === 403) {
            throw new Error('Google API token expired');
          }
            const errorBody = await response.text();
            console.error(`Failed to send new email: ${response.status}`, errorBody);
             try {
                const errorJson = JSON.parse(errorBody);
                if (errorJson?.error?.message) {
                throw new Error(`Failed to send email: ${errorJson.error.message} (Status: ${response.status})`);
                }
            } catch (parseError) { /* Ignore */ }
            throw new Error(`Failed to send email: ${response.status}`);
        }

        // If response is ok, assume success
        console.log('New email sent successfully via Gmail API.');
        return true;

    } catch (error) {
        console.error(`Error sending new email:`, error);
        // Re-throw the error so the calling component (ComposeDialog) can handle it
        throw error;
    }
};

// --- Function to Mark a Message as Read (Remove UNREAD label) ---
export const markMessageAsRead = async (messageId: string): Promise<boolean> => {
  // getGmailAccessToken now throws an error if token is not available,
  // so we don't need the explicit check here.
  const accessToken = await getGmailAccessToken();
  // The catch block in the calling component will handle the error.

  if (!messageId) {
    console.error('Cannot mark message as read: messageId is missing.');
    return false;
  }

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'] // Standard Gmail label for unread messages
      }),
    });

    if (!response.ok) {
       if (response.status === 401 || response.status === 403) {
        throw new Error('Google API token expired');
      }
      const errorBody = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
      console.error(`Failed to mark message ${messageId} as read: ${response.status}`, errorBody);
      // Optionally throw an error to be caught by the caller
      // throw new Error(`Failed to mark as read: ${errorBody?.error?.message || response.statusText}`);
      return false; // Indicate failure
    }

    console.log(`Message ${messageId} marked as read.`);
    return true; // Indicate success

  } catch (error) {
    console.error(`Error marking message ${messageId} as read:`, error);
    // Optionally re-throw
    // throw error;
    return false; // Indicate failure
  }
};

// Function to add a tag to an email
export const addTagToEmail = async (userId: string, emailId: string, tagId: string): Promise<boolean> => {
    if (!userId || !emailId || !tagId) return false;

    try {
        // 1. Check if the email exists in the emails table
        const { data: existingEmail, error: selectError } = await supabase
            .from('emails')
            .select('email_id')
            .eq('email_id', emailId)
            .eq('user_id', userId)
            .maybeSingle();

        if (selectError) {
            console.error('Error checking existing email:', selectError);
            return false;
        }

        // 2. If the email doesn't exist, insert it
        if (!existingEmail) {
            const { error: insertError } = await supabase
                .from('emails')
                .insert([{ email_id: emailId, user_id: userId, tags: [], is_starred: false }]); // Default values

            if (insertError) {
                console.error('Error inserting new email:', insertError);
                return false;
            }
        }

        // 3. Add the tag to the email_tags table
        const { error } = await supabase
            .from('email_tags')
            .insert([{ email_id: emailId, tag_id: tagId, user_id: userId }]);

        if (error) {
            console.error(`Error adding tag ${tagId} to email ${emailId}:`, error);
            return false;
        }

        return true;
    } catch (error) {
        console.error(`Exception adding tag ${tagId} to email ${emailId}:`, error);
        return false;
    }
};

// Function to remove a tag from an email
export const removeTagFromEmail = async (userId: string, emailId: string, tagId: string): Promise<boolean> => {
    if (!userId || !emailId || !tagId) return false;

    let removalSuccess = false; // Track if the main deletion worked
    try {
        // 1. Delete the tag association
        const { error: deleteError } = await supabase
            .from('email_tags')
            .delete()
            .eq('email_id', emailId)
            .eq('tag_id', tagId)
            .eq('user_id', userId);

        if (deleteError) {
            console.error(`Error removing tag ${tagId} from email ${emailId}:`, deleteError);
            return false; // If deletion fails, return false
        }

        removalSuccess = true; // Mark deletion as successful

        // 2. Log the removal event (fire and forget, but log errors)
        const { error: logError } = await supabase
            .from('removed_email_tags_log')
            .insert({
                email_id: emailId,
                tag_id: tagId,
                user_id: userId
                // removed_at is set by default
            });

        if (logError) {
            console.error(`Failed to log tag removal for email ${emailId}, tag ${tagId}:`, logError);
            // Do not return false here, the removal itself succeeded.
        }

        return true; // Return true since the removal was successful

    } catch (error) {
        console.error(`Exception removing tag ${tagId} from email ${emailId}:`, error);
        // Return the tracked success status in case of unexpected errors after deletion
        return removalSuccess;
    }
};

// Function to fetch the tag IDs associated with an email
export const fetchEmailTagIds = async (userId: string, emailId: string): Promise<string[]> => {
    if (!userId || !emailId) return [];

    try {
        const { data, error } = await supabase
            .from('email_tags')
            .select('tag_id')
            .eq('email_id', emailId)
            .eq('user_id', userId);

        if (error) {
            console.error(`Error fetching tag IDs for email ${emailId}:`, error);
            return [];
        }

        return data ? data.map(item => item.tag_id) : [];
    } catch (error) {
        console.error(`Exception fetching tag IDs for email ${emailId}:`, error);
        return [];
    }
};

// Function to fetch tags of a specific type for a user
export const fetchTags = async (userId: string, type: 'pin' | 'priority'): Promise<{ id: string; name: string; type: string; color: string }[]> => {
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('tags')
            .select('id, name, type, color')
            .eq('user_id', userId)
            .eq('type', type);

        if (error) {
            console.error(`Error fetching ${type} tags:`, error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error(`Exception fetching ${type} tags:`, error);
        return [];
    }
};

// Function to delete a tag and its associations
export const deleteTag = async (tagId: string, userId: string): Promise<boolean> => {
    if (!tagId || !userId) return false;

    try {
        // 1. Delete associations from email_tags
        const { error: deleteAssociationsError } = await supabase
            .from('email_tags')
            .delete()
            .match({ tag_id: tagId, user_id: userId });

        if (deleteAssociationsError) {
            console.error(`Error deleting tag associations for tag ${tagId}:`, deleteAssociationsError);
            // Decide if you want to stop or continue if associations fail to delete
            // For now, we'll log and continue to attempt tag deletion
        }

        // 2. Delete the tag itself from tags
        const { error: deleteTagError } = await supabase
            .from('tags')
            .delete()
            .match({ id: tagId, user_id: userId });

        if (deleteTagError) {
            console.error(`Error deleting tag ${tagId}:`, deleteTagError);
            return false; // If deleting the tag itself fails, return false
        }

        console.log(`Tag ${tagId} and its associations deleted successfully.`);
        return true; // Return true only if the tag deletion was successful

    } catch (error) {
        console.error(`Exception deleting tag ${tagId}:`, error);
        return false;
    }
};

// --- Function to fetch email IDs tagged today ---
export const fetchEmailIdsTaggedToday = async (userId: string): Promise<string[]> => {
  if (!userId) return [];

  try {
    const { data, error } = await supabase.rpc('get_emails_tagged_today', {
      user_id_param: userId,
    });

    if (error) {
      console.error(`Error fetching email IDs tagged today:`, error);
      throw error; // Re-throw to allow caller to handle
    }

    // The RPC function returns a set of text, which Supabase client might return as an array of strings
    return data || [];
  } catch (error) {
    console.error(`Exception fetching email IDs tagged today:`, error);
    throw error; // Re-throwing is often better for UI feedback
  }
};
// --- Function to fetch email IDs and thread IDs by tag name ---
export interface TaggedEmailIdentifier {
  email_id: string;
  thread_id: string;
}

export const fetchEmailIdsAndThreadIdsByTag = async (
  userId: string,
  tagName: string
): Promise<TaggedEmailIdentifier[]> => {
  if (!userId || !tagName) return [];

  try {
    const { data, error } = await supabase.rpc('get_email_ids_by_tag', {
      user_id_param: userId,
      tag_name_param: tagName,
    });

    if (error) {
      console.error(`Error fetching email IDs for tag "${tagName}":`, error);
      throw error; // Re-throw to allow caller to handle
    }

    return data || [];
  } catch (error) {
    console.error(`Exception fetching email IDs for tag "${tagName}":`, error);
    // Depending on how you want to handle errors upstream, you might re-throw or return empty
    throw error; // Re-throwing is often better for UI feedback
    // return [];
  }
};



// --- Body Decoding and Parsing Helpers ---

// Decode base64url string
export const decodeBase64Body = (data: string | undefined): string => {
  if (!data) return '';
  try {
    // Replace base64url characters and add padding if needed
    let base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    console.error("Error decoding base64 body:", e);
    return ''; // Return empty string on error
  }
};

// Find the most suitable body part (prefer text/html over text/plain)
export const findBestBodyPart = (payload: GmailMessagePayload | undefined): GmailMessagePart | null => {
  if (!payload) return null;

  let htmlPart: GmailMessagePart | null = null;
  let textPart: GmailMessagePart | null = null;

  const findPartsRecursive = (part: GmailMessagePayload | GmailMessagePart) => {
    if (part.mimeType === 'text/html' && part.body?.data) {
      htmlPart = part as GmailMessagePart; // Found HTML, prioritize this
      return; // Stop searching if HTML is found
    }
    if (part.mimeType === 'text/plain' && part.body?.data && !htmlPart) {
      textPart = part as GmailMessagePart; // Found text, keep searching for HTML
    }

    // Recurse into multipart/* parts if HTML not found yet
    if (!htmlPart && part.parts && part.mimeType.startsWith('multipart/')) {
      for (const subPart of part.parts) {
        if (htmlPart) break; // Stop if HTML found in sub-search
        findPartsRecursive(subPart);
      }
    }
  };

  findPartsRecursive(payload);

  // Return HTML if found, otherwise text, otherwise null
  return htmlPart || textPart || null;
};

// --- New Function for Supabase Data ---
export interface SupabaseEmailData {
  email_id: string;
  is_starred: boolean;
  tags: { id: string; name: string; color: string; type: string }[];
}

export const fetchSupabaseEmailData = async (userId: string, emailIds: string[]): Promise<SupabaseEmailData[]> => {
  if (!userId || emailIds.length === 0) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('emails')
      .select(`
        email_id,
        is_starred,
        email_tags (
          tag_id,
          tags (
            id,
            name,
            color,
            type
          )
        )
      `)
      .eq('user_id', userId)
      .in('email_id', emailIds);

    if (error) {
      console.error('Error fetching Supabase email data:', error);
      return [];
    }

    // Process the data to extract the tag information
    const processedData = (data || []).map(email => {
      const tags = email.email_tags
        .map(emailTag => {
          let tagObject: any = null; // Use 'any' temporarily or define a proper intermediate type

          // Determine the correct tag object based on whether 'tags' is an array or object
          if (emailTag.tags) {
            if (Array.isArray(emailTag.tags) && emailTag.tags.length > 0) {
              tagObject = emailTag.tags[0]; // Assume first element if array
            } else if (typeof emailTag.tags === 'object' && !Array.isArray(emailTag.tags)) {
              tagObject = emailTag.tags; // Assume it's the object if not array
            }
          }

          // Now, safely access properties from the determined tagObject
          if (tagObject && tagObject.id) {
            return {
              id: tagObject.id,
              name: tagObject.name,
              color: tagObject.color,
              type: tagObject.type,
            };
          }

          // Log if no valid tag object was found
          if (emailTag.tags) { // Avoid logging if email_tags itself was empty
             console.warn(`Missing, invalid, or unexpected nested tag data structure for email_tag related to email ${email.email_id}`, emailTag.tags);
          }
          return null;
        })
        .filter(tag => tag !== null) as { id: string; name: string; color: string; type: string }[]; // Type assertion after filtering nulls

      return {
        email_id: email.email_id,
        is_starred: email.is_starred ?? false, // Ensure is_starred has a default
        tags: tags,
      };
    });

    return processedData;
  } catch (error) {
    console.error('Exception fetching Supabase email data:', error);
    return [];
  }
};

// --- New Function to Update Supabase Data ---
// Uses manual check-then-insert/update for better RLS compatibility
export const updateSupabaseEmail = async (
  userId: string,
  emailId: string,
  updateData: Partial<Omit<SupabaseEmailData, 'email_id'>> // Allow updating tags or starred status
): Promise<boolean> => {
  if (!userId || !emailId) return false;

  try {
    // 1. Check if the record exists for this user
    const { data: existing, error: selectError } = await supabase
        .from('emails')
        .select('email_id')
        .eq('user_id', userId)
        .eq('email_id', emailId)
        .maybeSingle();

    if (selectError) {
        console.error('Error checking existing Supabase email data:', selectError);
        return false;
    }

    let error;
    if (existing) {
        // 2a. Update existing record
        // Only include fields that are actually being updated
        const dataToUpdate: Partial<SupabaseEmailData> = {};
        if (updateData.hasOwnProperty('is_starred')) {
            dataToUpdate.is_starred = updateData.is_starred;
        }
        if (updateData.hasOwnProperty('tags')) {
            dataToUpdate.tags = updateData.tags ?? []; // Ensure it's an array
        }
        // Add updated_at if needed: created_at: new Date().toISOString();

        if (Object.keys(dataToUpdate).length > 0) { // Only update if there's something to change
            const { error: updateError } = await supabase
                .from('emails')
                .update(dataToUpdate)
                .eq('user_id', userId)
                .eq('email_id', emailId);
            error = updateError;
        }
    } else {
        // 2b. Insert new record
        // Ensure all required fields are present
        const dataToInsert: SupabaseEmailData & { user_id: string } = {
            email_id: emailId,
            user_id: userId,
            is_starred: updateData.is_starred ?? false, // Default starred if inserting
            tags: updateData.tags ?? [], // Default tags if inserting
            // Add created_at if needed: created_at: new Date().toISOString()
        };
        
        const { error: insertError } = await supabase
            .from('emails')
            .insert(dataToInsert);
        error = insertError;
    }

    if (error) {
      console.error('Error saving Supabase email data:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Exception saving Supabase email data:', error);
    return false;
  }
};


// --- Timeline Functions --- (Moved to top level)

// Export the interface
export interface TimelineEvent {
    id: string; // Unique ID for the event (can be log ID or original item ID)
    type: 'EMAIL_TAG_ADDED' | 'EMAIL_TAG_REMOVED' | 'CARD_CREATED' | 'CARD_UPDATED' | 'CARD_DELETED' | 'CALENDAR_EVENT_CREATED' | 'CALENDAR_EVENT_UPDATED' | 'CALENDAR_EVENT_DELETED'; // Added Calendar types
    timestamp: string; // ISO string format
    data: any; // Type will vary based on event type
}

// Fetch recent email tag additions and removals (Export the function)
export const fetchRecentEmailTagActivity = async (userId: string, limit: number = 20): Promise<TimelineEvent[]> => {
    if (!userId) return [];

    // Fetch recent additions
    const { data: additions, error: additionsError } = await supabase
        .from('email_tags')
        .select(`
            created_at,
            email_id,
            tag_id,
            tags ( id, name, color, type )
        `) // Removed id, added tag_id
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (additionsError) {
        console.error("Error fetching recent email tag additions:", additionsError);
        // Decide how to handle - throw or return partial/empty
        // For now, let's throw to make the error visible
         throw new Error(`Failed to fetch email tag additions: ${additionsError.message}`);
    }

    // Fetch recent removals
    const { data: removals, error: removalsError } = await supabase
        .from('removed_email_tags_log')
        .select(`
            id,
            removed_at,
            email_id,
            tag_id,
            tags ( id, name, color, type )
        `) // Ensure tag_id is selected, join syntax remains standard
        .eq('user_id', userId)
        .order('removed_at', { ascending: false })
        .limit(limit);

     if (removalsError) {
        console.error("Error fetching recent email tag removals:", removalsError);
        // Decide how to handle - throw or return partial/empty
         throw new Error(`Failed to fetch email tag removals: ${removalsError.message}`);
    }

    // Process and combine results
    const combined: TimelineEvent[] = [];

    additions?.forEach(item => {
        console.log("Processing addition item:", JSON.stringify(item)); // Log raw item
        // item should now have email_id and tag_id from the select
        if (item.tags && typeof item.tags === 'object' && !Array.isArray(item.tags) && item.email_id && item.tag_id) { // Check for needed IDs
             const tagData = item.tags as { id: string; name: string; color: string; type: string };
             combined.push({
                id: `add-${item.email_id}-${item.tag_id}`, // Use composite ID based on email and tag
                type: 'EMAIL_TAG_ADDED',
                timestamp: item.created_at,
                data: {
                    emailId: item.email_id,
                    tag: tagData
                }
            });
        } else {
             console.warn("Skipping addition item due to missing/invalid tags data:", item);
        }
    });

    removals?.forEach(item => {
         console.log("Processing removal item:", JSON.stringify(item)); // Log raw item
         if (item.tags && typeof item.tags === 'object' && !Array.isArray(item.tags)) { // More robust check
             const tagData = item.tags as { id: string; name: string; color: string; type: string };
             combined.push({
                id: `remove-${item.id}`,
                type: 'EMAIL_TAG_REMOVED',
                timestamp: item.removed_at,
                data: {
                    emailId: item.email_id,
                    tag: tagData
                }
            });
         } else {
             console.warn("Skipping removal item due to missing/invalid tags data:", item);
         }
    });

    // Sort combined results by timestamp descending
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Return the combined list, potentially truncated to the overall limit if needed
    return combined.slice(0, limit);
};

// --- Calendar Event Tag Functions ---

// Define a Tag type based on fetchTags return type
interface Tag {
  id: string;
  name: string;
  type: 'pin' | 'priority' | string; // Allow for other types if needed
  color: string;
}

/**
 * Fetches tags associated with multiple Google Calendar event IDs for a specific user.
 * @param userId The ID of the user.
 * @param eventIds An array of Google Calendar event IDs.
 * @returns A Promise resolving to a Map where keys are event IDs and values are arrays of associated Tag objects.
 */
export const fetchCalendarEventTagsForEventIds = async (
  userId: string,
  eventIds: string[]
): Promise<Map<string, Tag[]>> => {
  if (!userId || eventIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('calendar_event_tags')
      .select(`
        event_id,
        tags (
          id,
          name,
          type,
          color
        )
      `)
      .eq('user_id', userId)
      .in('event_id', eventIds);

    if (error) {
      console.error('Error fetching calendar event tags:', error);
      throw error;
    }

    const tagsByEventId = new Map<string, Tag[]>();
    if (data) {
      data.forEach((item: any) => {
        // The join returns the tag object directly if the relation is one-to-one in the select,
        // or potentially an array if it's one-to-many. Assuming 'tags' is the related table object.
        if (item.tags && item.event_id) {
          const currentTags = tagsByEventId.get(item.event_id) || [];
          // Type assertion as Tag, assuming the structure from the 'tags' table matches
          currentTags.push(item.tags as Tag);
          tagsByEventId.set(item.event_id, currentTags);
        } else {
             console.warn("Skipping calendar tag item due to missing tag or event_id:", item);
        }
      });
    }

    return tagsByEventId;
  } catch (err) {
    console.error('Exception fetching calendar event tags:', err);
    return new Map(); // Return empty map on error
  }
};


/**
 * Sets the tags for a specific Google Calendar event, replacing existing tags.
 * @param userId The ID of the user.
 * @param eventId The Google Calendar event ID.
 * @param tagIds An array of tag IDs to associate with the event.
 */
export const setTagsForCalendarEvent = async (
  userId: string,
  eventId: string,
  tagIds: string[]
): Promise<void> => {
  if (!userId || !eventId) {
    console.error('User ID and Event ID are required to set tags.');
    return;
  }

  try {
    // Start a transaction (optional but safer for multi-step operations)
    // Note: Supabase JS client doesn't directly support multi-statement transactions easily.
    // We'll perform delete then insert. Consider a database function for atomicity if critical.

    // 1. Delete existing tags for this user and event
    const { error: deleteError } = await supabase
      .from('calendar_event_tags')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting existing calendar event tags:', deleteError);
      throw deleteError;
    }

    // 2. Insert new tags if any are provided
    if (tagIds.length > 0) {
      const newLinks = tagIds.map(tagId => ({
        user_id: userId,
        event_id: eventId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from('calendar_event_tags')
        .insert(newLinks);

      if (insertError) {
        console.error('Error inserting new calendar event tags:', insertError);
        // Consider how to handle partial failure (e.g., if delete succeeded but insert failed)
        throw insertError;
      }
    }
    console.log(`Tags updated successfully for event ${eventId}`);

  } catch (err) {
    console.error(`Exception setting tags for calendar event ${eventId}:`, err);
    // Re-throw or handle as needed
    throw err;
  }
};

/**
 * Deletes all tag associations for a specific Google Calendar event for a given user.
 * Typically used when the event itself is deleted.
 * @param userId The ID of the user.
 * @param eventId The Google Calendar event ID.
 */
export const deleteCalendarEventTags = async (
    userId: string,
    eventId: string
): Promise<void> => {
    if (!userId || !eventId) {
        console.error('User ID and Event ID are required to delete calendar tags.');
        return;
    }

    try {
        const { error } = await supabase
            .from('calendar_event_tags')
            .delete()
            .eq('user_id', userId)
            .eq('event_id', eventId);

        if (error) {
            console.error(`Error deleting tags for calendar event ${eventId}:`, error);
            throw error;
        }

        console.log(`Tags deleted successfully for event ${eventId}`);
    } catch (err) {
        console.error(`Exception deleting tags for calendar event ${eventId}:`, err);
        throw err;
    }
};
