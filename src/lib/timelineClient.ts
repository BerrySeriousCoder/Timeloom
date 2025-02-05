import { supabase } from './supabaseClient';

// --- Interfaces ---

// Reusing Tag definition (ensure consistency if defined elsewhere)
interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

// Interface for the data needed to create/update a card
export interface TimelineCardInput {
  title: string;
  description?: string;
  start_date: string; // Expecting YYYY-MM-DD format
  end_date?: string | null; // Expecting YYYY-MM-DD format or null
}

// Interface for the full card data, including generated fields and tags
export interface TimelineCard extends TimelineCardInput {
  id: string;
  user_id: string;
  created_at: string;
  tags?: Tag[]; // Tags will be joined in fetch
}

// --- API Functions ---

/**
 * Fetches all custom timeline cards for a user, including associated tags.
 * @param userId The ID of the user.
 * @returns Promise resolving to an array of TimelineCard objects with tags.
 */
export const fetchTimelineCardsWithTags = async (userId: string): Promise<TimelineCard[]> => {
  if (!userId) {
    console.error("User ID is required to fetch timeline cards.");
    return [];
  }

  try {
    // Fetch cards and their associated tags using joins
    const { data: cardsData, error: cardsError } = await supabase
      .from('timeline_custom_cards')
      .select(`
        id,
        user_id,
        title,
        description,
        start_date,
        end_date,
        created_at,
        timeline_card_tags (
          tags ( id, name, color, type )
        )
      `)
      .eq('user_id', userId)
      .order('start_date', { ascending: true });

    if (cardsError) {
      console.error('Error fetching timeline cards with tags:', cardsError);
      throw cardsError;
    }
    if (!cardsData) return [];

    // Process the data to flatten the tags structure
    const processedCards = cardsData.map(card => {
      // Extract the tag objects from the nested structure
      const tags = card.timeline_card_tags?.map((link: any) => link.tags).filter(Boolean) || [];
      // Return the card object with the flattened tags array
      return {
        id: card.id,
        user_id: card.user_id,
        title: card.title,
        description: card.description,
        start_date: card.start_date,
        end_date: card.end_date,
        created_at: card.created_at,
        tags: tags as Tag[], // Assert the type after filtering
      };
    });

    return processedCards;

  } catch (err) {
    console.error("Exception fetching timeline cards:", err);
    return []; // Return empty array on error
  }
};

/**
 * Creates a new custom timeline card.
 * @param userId The ID of the user creating the card.
 * @param cardData The data for the new card.
 * @returns Promise resolving to the newly created TimelineCard object (without tags initially).
 */
export const createTimelineCard = async (userId: string, cardData: TimelineCardInput): Promise<Omit<TimelineCard, 'tags'>> => {
  if (!userId) {
    throw new Error("User ID is required to create a timeline card.");
  }
  if (!cardData.title || !cardData.start_date) {
      throw new Error("Title and Start Date are required to create a timeline card.");
  }

  try {
    const { data, error } = await supabase
      .from('timeline_custom_cards')
      .insert([{ ...cardData, user_id: userId }])
      // Explicitly select columns from the main table only
      .select('id, user_id, title, description, start_date, end_date, created_at')
      .select()
      .single();

    if (error) {
      console.error('Error creating timeline card:', error);
      throw error;
    }

    if (!data) {
        throw new Error("Failed to create timeline card, no data returned.");
    }

    return data;
  } catch (err) {
    console.error("Exception creating timeline card:", err);
    throw err; // Re-throw for the caller to handle
  }
};

/**
 * Updates an existing custom timeline card.
 * @param userId The ID of the user updating the card.
 * @param cardId The ID of the card to update.
 * @param cardData The updated data for the card.
 * @returns Promise resolving to the updated TimelineCard object (without tags).
 */
export const updateTimelineCard = async (userId: string, cardId: string, cardData: Partial<TimelineCardInput>): Promise<Omit<TimelineCard, 'tags'>> => {
  if (!userId || !cardId) {
    throw new Error("User ID and Card ID are required to update a timeline card.");
  }

  try {
    const { data, error } = await supabase
      .from('timeline_custom_cards')
      .update(cardData)
      .eq('id', cardId)
      .eq('user_id', userId) // Ensure user owns the card
      // Explicitly select columns from the main table only
      .select('id, user_id, title, description, start_date, end_date, created_at')
      .select()
      .single();

    if (error) {
      console.error(`Error updating timeline card ${cardId}:`, error);
      throw error;
    }
     if (!data) {
        throw new Error(`Failed to update timeline card ${cardId}, no data returned (or permission denied).`);
    }

    return data;
  } catch (err) {
    console.error(`Exception updating timeline card ${cardId}:`, err);
    throw err;
  }
};

/**
 * Deletes a custom timeline card. Also handles deleting associated tags via cascade delete.
 * @param userId The ID of the user deleting the card.
 * @param cardId The ID of the card to delete.
 * @returns Promise resolving when deletion is successful.
 */
export const deleteTimelineCard = async (userId: string, cardId: string): Promise<void> => {
  if (!userId || !cardId) {
    throw new Error("User ID and Card ID are required to delete a timeline card.");
  }

  try {
    const { error } = await supabase
      .from('timeline_custom_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', userId); // Ensure user owns the card

    if (error) {
      console.error(`Error deleting timeline card ${cardId}:`, error);
      throw error;
    }
    console.log(`Timeline card ${cardId} deleted successfully.`);
  } catch (err) {
    console.error(`Exception deleting timeline card ${cardId}:`, err);
    throw err;
  }
};

/**
 * Sets the tags for a specific timeline card, replacing existing tags.
 * @param userId The ID of the user.
 * @param cardId The ID of the timeline card.
 * @param tagIds An array of tag IDs to associate with the card.
 */
export const setTagsForTimelineCard = async (userId: string, cardId: string, tagIds: string[]): Promise<void> => {
  if (!userId || !cardId) {
    console.error('User ID and Card ID are required to set timeline card tags.');
    return;
  }

  try {
    // 1. Delete existing tags for this user and card
    const { error: deleteError } = await supabase
      .from('timeline_card_tags')
      .delete()
      .eq('user_id', userId) // RLS should handle this, but explicit check is safer
      .eq('card_id', cardId);

    if (deleteError) {
      console.error('Error deleting existing timeline card tags:', deleteError);
      throw deleteError;
    }

    // 2. Insert new tags if any are provided
    if (tagIds.length > 0) {
      const newLinks = tagIds.map(tagId => ({
        user_id: userId,
        card_id: cardId,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from('timeline_card_tags')
        .insert(newLinks);

      if (insertError) {
        console.error('Error inserting new timeline card tags:', insertError);
        throw insertError;
      }
    }
    console.log(`Tags updated successfully for timeline card ${cardId}`);

  } catch (err) {
    console.error(`Exception setting tags for timeline card ${cardId}:`, err);
    throw err;
  }
};


/**
 * Deletes all tag associations for a specific timeline card.
 * Note: This might be redundant if ON DELETE CASCADE is set correctly on the foreign key.
 * However, it can be called explicitly for safety or if cascade is not used.
 * @param userId The ID of the user.
 * @param cardId The ID of the timeline card.
 */
export const deleteTimelineCardTags = async (userId: string, cardId: string): Promise<void> => {
    if (!userId || !cardId) {
        console.error('User ID and Card ID are required to delete timeline card tags.');
        return;
    }

    try {
        const { error } = await supabase
            .from('timeline_card_tags')
            .delete()
            .eq('user_id', userId) // RLS should handle this
            .eq('card_id', cardId);

        if (error) {
            console.error(`Error deleting tags for timeline card ${cardId}:`, error);
            throw error;
        }

        console.log(`Tags deleted successfully for timeline card ${cardId}`);
    } catch (err) {
        console.error(`Exception deleting tags for timeline card ${cardId}:`, err);
        throw err;
    }
};