import { supabase } from './supabaseClient';

// Define the structure for a tag
export interface CardTag {
  id: string;
  name: string;
  color: string;
  type: string;
}

export interface CustomCard {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags: CardTag[]; // Add tags array
}

// Fetch all custom cards for the logged-in user
export const getCards = async (): Promise<CustomCard[]> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError);
    throw new Error('User not authenticated');
  }

  // Fetch cards and their associated tags using joins
  // Note: Supabase JS v2 doesn't directly support JSON aggregation in select like SQL.
  // We fetch cards and then fetch tags for each card, or use an RPC function.
  // Let's try fetching cards first, then tags separately for simplicity, though less efficient.

  // 1. Fetch Cards
  const { data: cardsData, error: cardsError } = await supabase
    .from('custom_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (cardsError) {
    console.error('Error fetching cards:', cardsError);
    throw cardsError;
  }
  if (!cardsData) return [];

  // 2. Fetch all relevant tag associations for these cards
  const cardIds = cardsData.map(card => card.id);
  if (cardIds.length === 0) return cardsData.map(card => ({ ...card, tags: [] })); // Return cards with empty tags if no cards found

  const { data: tagLinks, error: tagLinksError } = await supabase
    .from('custom_card_tags')
    .select('card_id, tags ( id, name, color, type )') // Select card_id and nested tag details
    .eq('user_id', user.id)
    .in('card_id', cardIds);

  if (tagLinksError) {
    console.error('Error fetching card tag links:', tagLinksError);
    throw tagLinksError; // Or handle more gracefully, maybe return cards without tags
  }

  // 3. Map tags to their respective cards
  const tagsByCardId = new Map<string, CardTag[]>();
  tagLinks?.forEach(link => {
    // link.tags should be a single object or null based on the join
    if (link.tags && typeof link.tags === 'object' && !Array.isArray(link.tags)) {
      const currentTags = tagsByCardId.get(link.card_id) || [];
      // Correctly type the fetched tag data
      const tagData = link.tags as CardTag;
      tagsByCardId.set(link.card_id, [...currentTags, tagData]);
    } else if (link.tags) {
        // Log if the structure is unexpected (e.g., an array)
        console.warn("Unexpected structure for link.tags:", link.tags);
    }
  });

  // 4. Combine card data with tags
  const cardsWithTags: CustomCard[] = cardsData.map(card => ({
    ...card,
    tags: tagsByCardId.get(card.id) || [], // Assign tags or empty array if none found
  }));

  return cardsWithTags;
};

// Create a new custom card
export const createCard = async (title: string, content: string, tagIds: string[] = []): Promise<CustomCard> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError);
    throw new Error('User not authenticated');
  }

  // 1. Insert the card
  const { data: newCard, error: createError } = await supabase
    .from('custom_cards')
    .insert([{ title, content, user_id: user.id }])
    .select()
    .single();

  if (createError) {
    console.error('Error creating card:', createError);
    throw createError;
  }
  if (!newCard) {
     throw new Error('Card creation did not return data');
  }

  // 2. Insert tag associations if tagIds are provided
  if (tagIds.length > 0) {
    const tagInserts = tagIds.map(tagId => ({
      card_id: newCard.id,
      tag_id: tagId,
      user_id: user.id,
    }));

    const { error: tagInsertError } = await supabase
      .from('custom_card_tags')
      .insert(tagInserts);

    if (tagInsertError) {
      console.error('Error adding tags during card creation:', tagInsertError);
      // Decide how to handle: maybe delete the card? Or just log the error?
      // For now, we'll throw, but a transaction would be better in a real app.
      throw new Error(`Card created, but failed to add tags: ${tagInsertError.message}`);
    }
  }

  // 3. Log the creation event
  const { error: logError } = await supabase
    .from('custom_cards_log')
    .insert({
      card_id: newCard.id,
      user_id: user.id,
      activity_type: 'CREATED',
      title: newCard.title
      // activity_timestamp is set by default
    });

  if (logError) {
    console.error('Error logging card creation:', logError);
    // Don't throw error, card creation itself succeeded
  }

  // 4. Return the new card data (tags will be fetched separately by getCards)
  return { ...newCard, tags: [] };
};

// Update an existing custom card
export const updateCard = async (id: string, title: string, content: string, tagIds: string[] | null = null): Promise<CustomCard> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

   if (userError || !user) {
     console.error('Error fetching user:', userError);
     throw new Error('User not authenticated');
   }

   // 1. Update card title and content
  const { data: updatedCardData, error: updateError } = await supabase
    .from('custom_cards')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id) 
    .select()
    .single();

  if (updateError) {
    console.error('Error updating card:', updateError);
    throw updateError;
  }
   if (!updatedCardData) {
      throw new Error('Card update did not return data');
   }

   // 2. Update tags if tagIds are provided (null means don't change tags)
   if (tagIds !== null) {
       try {
           const currentTagIds = await fetchCardTagIds(user.id, id);

           const tagsToAdd = tagIds.filter(tagId => !currentTagIds.includes(tagId));
           const tagsToRemove = currentTagIds.filter(tagId => !tagIds.includes(tagId));

           // Perform removals first
           if (tagsToRemove.length > 0) {
               const removePromises = tagsToRemove.map(tagId => removeTagFromCard(user.id, id, tagId));
               await Promise.all(removePromises);
           }

           // Perform additions
           if (tagsToAdd.length > 0) {
               const addPromises = tagsToAdd.map(tagId => addTagToCard(user.id, id, tagId));
               await Promise.all(addPromises);
           }
       } catch (tagUpdateError) {
           console.error(`Error updating tags for card ${id}:`, tagUpdateError);

       }
   }

   // 3. Log the update event
   const { error: logError } = await supabase
       .from('custom_cards_log')
       .insert({
           card_id: id,
           user_id: user.id,
           activity_type: 'UPDATED',
           title: updatedCardData.title // Log the title after update
           // activity_timestamp is set by default
       });

   if (logError) {
       console.error('Error logging card update:', logError);
       // Don't throw error, card update itself succeeded
   }

   // 4. Return the updated card data (tags will be fetched separately by getCards)
  return { ...updatedCardData, tags: [] };
};

// Delete a custom card
export const deleteCard = async (id: string): Promise<void> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError);
    throw new Error('User not authenticated');
  }

  // 1. Fetch card details before deleting (for logging)
  const { data: cardToLog, error: fetchError } = await supabase
    .from('custom_cards')
    .select('title, content')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError) {
      console.error('Error fetching card details before deletion:', fetchError);
      // Decide if we should proceed with deletion or throw an error <--:TODO
  }

  // 2. Delete the card (associations in custom_card_tags should cascade delete)
  const { error: deleteError } = await supabase
    .from('custom_cards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Error deleting card:', deleteError);
    throw deleteError;
  }

  // 3. Log the deletion event to the unified log table
  const { error: logError } = await supabase
      .from('custom_cards_log') // Use the unified log table
      .insert({
          card_id: id, // Store the original card ID
          user_id: user.id,
          activity_type: 'DELETED',
          title: cardToLog?.title || null // Log title if fetched, otherwise null
          // activity_timestamp is set by default
      });

  if (logError) {
      console.error('Error logging card deletion:', logError);
      // Don't throw an error here, deletion itself succeeded.
  }
};

// --- Custom Card Tag Management ---

// Fetch tag IDs associated with a specific custom card
const fetchCardTagIds = async (userId: string, cardId: string): Promise<string[]> => {
  if (!userId || !cardId) return [];

  const { data, error } = await supabase
    .from('custom_card_tags')
    .select('tag_id')
    .eq('user_id', userId)
    .eq('card_id', cardId);

  if (error) {
    console.error(`Error fetching tags for card ${cardId}:`, error);
    // Decide if throwing an error or returning empty array is better <--:TODO
    throw new Error(`Failed to fetch tags for card ${cardId}: ${error.message}`);
    // return [];
  }

  return data?.map(item => item.tag_id) || [];
};



// Fetch recent card activity from the unified log table
export const fetchRecentCardActivity = async (userId: string, limit: number = 20) => { 
    if (!userId) return [];

    const { data: logs, error } = await supabase
        .from('custom_cards_log')
        .select('id, card_id, activity_type, title, activity_timestamp')
        .eq('user_id', userId)
        .order('activity_timestamp', { ascending: false })
        .limit(limit);

    if (error) {
        console.error("Error fetching card activity log:", error);
        throw new Error(`Failed to fetch card activity log: ${error.message}`);
    }
    if (!logs) {
        return [];
    }

    // Process logs into TimelineEvent format
    // Let TypeScript infer the type of timelineEvents
    const timelineEvents = logs.map(log => {
        // Define the possible event types generated *by this function*
        type CardActivityType = 'CARD_CREATED' | 'CARD_UPDATED' | 'CARD_DELETED';
        let eventType: CardActivityType;

        switch (log.activity_type) {
            case 'CREATED':
                eventType = 'CARD_CREATED';
                break;
            case 'UPDATED':
                eventType = 'CARD_UPDATED';
                break;
            case 'DELETED':
                eventType = 'CARD_DELETED';
                break;
            default:
                console.warn(`Unknown card activity type: ${log.activity_type}`);
                return null; // Skip unknown types
        }

        // Return type is inferred here
        return {
            id: `card-log-${log.id}`,
            type: eventType,
            timestamp: log.activity_timestamp,
            data: {
                cardId: log.card_id,
                cardTitle: log.title || '(Title unknown)'
            }
        };
    }).filter(event => event !== null); // Filter out nulls from skipped unknown types

    // The query already sorts by timestamp descending, so no extra sort needed here.
    return timelineEvents;
};

// Add a tag to a custom card
const addTagToCard = async (userId: string, cardId: string, tagId: string): Promise<boolean> => {
  if (!userId || !cardId || !tagId) return false;

  const { error } = await supabase
    .from('custom_card_tags')
    .insert({
      user_id: userId,
      card_id: cardId,
      tag_id: tagId,
    });

  if (error) {
    // Handle potential duplicate key error gracefully
    if (error.code === '23505') { // Unique violation
        console.warn(`Tag ${tagId} already exists for card ${cardId}.`);
        return true; // Consider it a success if already tagged
    }
    console.error(`Error adding tag ${tagId} to card ${cardId}:`, error);
    throw new Error(`Failed to add tag ${tagId} to card ${cardId}: ${error.message}`);
    // return false;
  }
  return true;
};

// Remove a tag from a custom card
const removeTagFromCard = async (userId: string, cardId: string, tagId: string): Promise<boolean> => {
  if (!userId || !cardId || !tagId) return false;

  const { error } = await supabase
    .from('custom_card_tags')
    .delete()
    .eq('user_id', userId)
    .eq('card_id', cardId)
    .eq('tag_id', tagId);

  if (error) {
    console.error(`Error removing tag ${tagId} from card ${cardId}:`, error);
    throw new Error(`Failed to remove tag ${tagId} from card ${cardId}: ${error.message}`);
    // return false;
  }
  return true;
};