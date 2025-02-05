import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import AddEditTimelineCardDialog from '@/components/timeline/AddEditTimelineCardDialog';
import {
    fetchTimelineCardsWithTags,
    TimelineCard 
} from '@/lib/timelineClient';

// Helper to format date range for display
const formatTimelineDateRange = (startDateStr: string, endDateStr?: string | null): string => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    try {
        const startDate = new Date(startDateStr + 'T00:00:00'); // Treat as local date
        if (isNaN(startDate.getTime())) return "Invalid Start Date";

        const formattedStart = startDate.toLocaleDateString(undefined, options);

        if (endDateStr) {
            const endDate = new Date(endDateStr + 'T00:00:00');
             if (isNaN(endDate.getTime())) return formattedStart; // Only show start if end is invalid
            const formattedEnd = endDate.toLocaleDateString(undefined, options);
            // Show range only if start and end are different days
            return startDate.toDateString() === endDate.toDateString() ? formattedStart : `${formattedStart} - ${formattedEnd}`;
        }
        return formattedStart; // Only start date provided
    } catch (e) {
        console.error("Error formatting date range:", e);
        return "Invalid Date";
    }
};


const TimelinePage = () => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [customTimelineCards, setCustomTimelineCards] = useState<TimelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<TimelineCard | null>(null);

  // --- Data Fetching ---
  const loadCustomCards = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
        setCustomTimelineCards([]); // Clear cards if not authenticated
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const cards = await fetchTimelineCardsWithTags(user.id);
      setCustomTimelineCards(cards);
    } catch (err: any) {
      console.error("Error fetching timeline cards:", err);
      setError(err.message || 'Failed to load custom timeline cards.');
      toast({
        title: "Error Loading Cards",
        description: err.message || 'Could not fetch custom timeline cards.',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id, toast]);

  // Initial load
  useEffect(() => {
    loadCustomCards();
  }, [loadCustomCards]);

  // --- Handlers ---
  const handleAddClick = () => {
    setCardToEdit(null); // Ensure edit mode is off
    setIsDialogOpen(true);
  };

  const handleEditClick = (card: TimelineCard) => {
    setCardToEdit(card);
    setIsDialogOpen(true);
  };

  // handleDeleteClick is handled within the dialog for confirmation

  const handleSaveSuccess = (savedCard: TimelineCard) => {
    // Optionally update state optimistically or just reload
    loadCustomCards(); // Reload the list
    toast({ title: "Success", description: `Card "${savedCard.title}" saved.` });
  };

  const handleDeleteSuccess = (deletedCardId: string) => {
    // Optionally update state optimistically or just reload
    loadCustomCards(); // Reload the list
    toast({ title: "Success", description: "Card deleted." });
  };

  // --- Render Logic ---
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        {isAuthenticated && (
            <Button onClick={handleAddClick} className="bg-purple hover:bg-purple/90">
                <Plus className="mr-2 h-4 w-4" /> Add Project
            </Button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-4 text-center text-red-600 bg-red-100 border border-red-300 rounded-md">
          Error: {error}
          <button onClick={loadCustomCards} className="ml-2 text-sm underline">Retry</button>
        </div>
      )}

       {/* Not Authenticated State */}
       {!isLoading && !error && !isAuthenticated && (
         <div className="text-center text-muted-foreground py-10 border rounded-md bg-muted/30">
            Please log in to view and manage your timeline.
         </div>
       )}

      {/* Empty State (Authenticated) */}
      {!isLoading && !error && isAuthenticated && customTimelineCards.length === 0 && (
        <div className="text-center text-muted-foreground py-10 border rounded-md bg-muted/30">
          No custom timeline cards created yet. Click "Add Timeline Card" to get started.
        </div>
      )}

      {/* Render Custom Cards */}
      {!isLoading && !error && isAuthenticated && customTimelineCards.length > 0 && (
        <div className="space-y-4">
          {customTimelineCards.map((card) => (
            <div key={card.id} className="border rounded-lg p-4 shadow-sm bg-card text-card-foreground">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold font-dmSans">{card.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatTimelineDateRange(card.start_date, card.end_date)}
                  </p>
                </div>
                <div className="flex items-center space-x-1">
                   <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(card)}>
                       <Edit className="h-4 w-4" />
                       <span className="sr-only">Edit Card</span>
                   </Button>
                   {/* Delete is handled via Edit Dialog */}
                </div>
              </div>
              {card.description && (
                <p className="text-sm mb-3">{card.description}</p>
              )}
              {/* Render Tags */}
              {card.tags && card.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {card.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs px-1.5 py-0.5 font-normal"
                      style={{ backgroundColor: tag.color, color: 'white' }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Render the Dialog */}
      <AddEditTimelineCardDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        cardToEdit={cardToEdit}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
};

export default TimelinePage;
