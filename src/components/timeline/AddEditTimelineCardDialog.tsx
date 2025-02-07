import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trash2, Tag } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { fetchTags } from '@/lib/supabaseClient'; // For fetching available tags
import {
    createTimelineCard,
    updateTimelineCard,
    deleteTimelineCard,
    setTagsForTimelineCard,
    TimelineCard, 
    TimelineCardInput 
} from '@/lib/timelineClient'; 

// Reusable Tag interface (ensure consistency)
interface TagData {
  id: string;
  name: string;
  type: string;
  color: string;
}

interface AddEditTimelineCardDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cardToEdit: TimelineCard | null; // Pass the full card data for editing
  onSaveSuccess: (savedCard: TimelineCard) => void;
  onDeleteSuccess: (deletedCardId: string) => void;
}

// Helper to format a Date object into YYYY-MM-DD for input fields
const formatDateForInput = (date: Date | string | undefined | null): string => {
    if (!date) return '';
    try {
        // Handle both Date objects and string representations
        const d = typeof date === 'string' ? new Date(date) : date;
        // Check if the date is valid after parsing
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error("Error formatting date for input:", e);
        return '';
    }
};


const AddEditTimelineCardDialog: React.FC<AddEditTimelineCardDialogProps> = ({
  isOpen,
  onOpenChange,
  cardToEdit,
  onSaveSuccess,
  onDeleteSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [endDate, setEndDate] = useState('');     // YYYY-MM-DD
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableTags, setAvailableTags] = useState<TagData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const isEditing = !!cardToEdit;

  // --- Populate form on edit ---
  useEffect(() => {
    if (isOpen) {
      if (isEditing && cardToEdit) {
        setTitle(cardToEdit.title || '');
        setDescription(cardToEdit.description || '');
        setStartDate(formatDateForInput(cardToEdit.start_date));
        setEndDate(formatDateForInput(cardToEdit.end_date)); // Handles null/undefined
        setSelectedTagIds(cardToEdit.tags?.map(tag => tag.id) || []);
      } else {
        // Reset form for adding
        setTitle('');
        setDescription('');
        setStartDate('');
        setEndDate('');
        setSelectedTagIds([]);
      }
    }
  }, [isOpen, isEditing, cardToEdit]);

  // --- Fetch Available Tags ---
  useEffect(() => {
    const loadTags = async () => {
      if (!user?.id || !isOpen) return;
      try {
        const fetchedPinTags = await fetchTags(user.id, 'pin');
        const fetchedPriorityTags = await fetchTags(user.id, 'priority');
        setAvailableTags([...fetchedPinTags, ...fetchedPriorityTags]);
      } catch (err) {
        console.error("Failed to fetch tags for dialog:", err);
        toast({ title: "Error", description: "Could not load tags.", variant: "destructive" });
        setAvailableTags([]);
      }
    };

    if (isOpen) {
        loadTags();
    }
    // Optional: Reset available tags when dialog closes
    return () => {
        if (!isOpen) {
            setAvailableTags([]);
        }
    }
  }, [user?.id, isOpen, toast]);

  // --- Tag Selection Handler ---
   const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  // --- Save Handler ---
  const handleSave = async () => {
    if (!title.trim() || !startDate) {
      toast({ title: "Missing Required Fields", description: "Please enter a title and start date.", variant: "destructive" });
      return;
    }
    if (endDate && startDate && new Date(endDate) < new Date(startDate)) {
        toast({ title: "Invalid Date Range", description: "End date cannot be before start date.", variant: "destructive" });
        return;
    }

    if (!user?.id) {
        toast({ title: "Authentication Error", description: "User not found.", variant: "destructive" });
        return;
    }

    setIsProcessing(true);

    const cardData: TimelineCardInput = {
      title: title.trim(),
      description: description.trim() || undefined, // Store undefined if empty
      start_date: startDate,
      end_date: endDate || null, // Store null if empty
    };

    try {
      let savedCardData: Omit<TimelineCard, 'tags'>;

      if (isEditing && cardToEdit) {
        savedCardData = await updateTimelineCard(user.id, cardToEdit.id, cardData);
        toast({ title: "Success", description: "Project card updated successfully!" });
      } else {
        savedCardData = await createTimelineCard(user.id, cardData);
        toast({ title: "Success", description: "Project card created successfully!" });
      }

      // --- Save Tags ---
      if (savedCardData?.id) {
        try {
          await setTagsForTimelineCard(user.id, savedCardData.id, selectedTagIds);
          console.log(`Tags saved successfully for timeline card ${savedCardData.id}`);
          // Add the saved tags to the card object before calling onSaveSuccess
          const finalTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));
          const finalCard: TimelineCard = { ...savedCardData, tags: finalTags };
          onSaveSuccess(finalCard); // Pass the full card with tags back
        } catch (tagError: any) {
          console.error("Error saving tags:", tagError);
          toast({
            title: "Warning",
            description: `Card saved, but failed to save tags: ${tagError.message}`,
            variant: "destructive",
          });
           // Still proceed, passing back the card data without tags
           const cardWithoutTags: TimelineCard = { ...savedCardData, tags: [] };
           onSaveSuccess(cardWithoutTags);
        }
      } else {
          console.warn("Could not save tags: Missing savedCardData.id");
          const cardWithoutTags: TimelineCard = { ...savedCardData, tags: [] };
          onSaveSuccess(cardWithoutTags); // Still call success callback
      }

      onOpenChange(false); // Close dialog on success
    } catch (error: any) {
      console.error("Error saving project card:", error);
      toast({
        title: "Error Saving Card",
        description: error.message || "Could not save the project card.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Delete Handler ---
  const handleDelete = async () => {
    if (!isEditing || !cardToEdit || !user?.id) return;

    setIsDeleting(true);
    const cardIdToDelete = cardToEdit.id;

    try {
      // Delete the card (tags should be deleted by CASCADE constraint)
      await deleteTimelineCard(user.id, cardIdToDelete);
      toast({ title: "Success", description: "Project card deleted." });

      // Notify parent component and close dialog
      onDeleteSuccess(cardIdToDelete);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting project card:", error);
      toast({
        title: "Error Deleting Card",
        description: error.message || "Could not delete the project card.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Project Card' : 'Add New Project Card'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modify the details below.' : 'Fill in the details for the new project card.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="timeline-title" className="text-right">Title*</Label>
            <Input
              id="timeline-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Card title"
              className="col-span-3"
              disabled={isProcessing || isDeleting}
            />
          </div>

          {/* Start Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="timeline-start-date" className="text-right">Start Date*</Label>
            <Input
              id="timeline-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="col-span-3"
              disabled={isProcessing || isDeleting}
            />
          </div>

          {/* End Date */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="timeline-end-date" className="text-right">End Date</Label>
            <Input
              id="timeline-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="col-span-3"
              disabled={isProcessing || isDeleting}
              min={startDate} // Prevent end date being before start date
            />
          </div>

          {/* Description */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="timeline-description" className="text-right pt-2">Description</Label>
            <Textarea
              id="timeline-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Card description (optional)"
              className="col-span-3 min-h-[100px]"
              disabled={isProcessing || isDeleting}
            />
          </div>

          {/* Tags */}
           <div className="grid grid-cols-4 items-center gap-4">
             <Label className="text-right">Tags</Label>
             <div className="col-span-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full justify-start text-left font-normal" disabled={isProcessing || isDeleting}>
                            <Tag className="mr-2 h-4 w-4" />
                            <span>{selectedTagIds.length > 0 ? `${selectedTagIds.length} tag(s) selected` : 'Select tags...'}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        <DropdownMenuLabel>Available Tags</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableTags.length > 0 ? (
                            availableTags.map(tag => (
                                <DropdownMenuItem key={tag.id} className="p-0" onSelect={(e) => e.preventDefault()}>
                                    <label htmlFor={`timeline-tag-${tag.id}`} className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer">
                                        <span className="flex items-center">
                                             <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }}></span>
                                             {tag.name} ({tag.type})
                                        </span>
                                        <Checkbox
                                            id={`timeline-tag-${tag.id}`}
                                            checked={selectedTagIds.includes(tag.id)}
                                            onCheckedChange={() => handleTagToggle(tag.id)}
                                            className="ml-2"
                                            aria-label={`Tag card with ${tag.name}`}
                                        />
                                    </label>
                                </DropdownMenuItem>
                            ))
                        ) : (
                            <DropdownMenuItem disabled>No tags available</DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
           </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div> {/* Left side buttons */}
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isProcessing || isDeleting}
                size="sm"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            )}
          </div>
          <div> {/* Right side buttons */}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isProcessing || isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isProcessing || isDeleting}
              className="ml-2 bg-purple hover:bg-purple/90"
            >
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isProcessing ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Card')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditTimelineCardDialog;