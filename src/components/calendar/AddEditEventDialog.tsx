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
import { EventInput } from '@fullcalendar/core';
import {
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    GoogleCalendarEventInput,
    GoogleCalendarEvent 
} from '@/lib/googleCalendarClient';
import { useAuth } from '@/components/providers/AuthProvider'; 
import {
    fetchTags,
    setTagsForCalendarEvent,
    deleteCalendarEventTags
} from '@/lib/supabaseClient'; 


interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

// Extend EventInput to include our custom tags in extendedProps for editing
interface EventInputWithTags extends EventInput {
    extendedProps?: {
        description?: string;
        tags?: Tag[]; // Expect tags here when editing
        [key: string]: any; // Allow other extended props
    };
}

interface AddEditEventDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventInputWithTags | null; // Use the extended type
  dateRange: { start: Date, end: Date } | null;
  onSaveSuccess: (savedEvent: GoogleCalendarEvent) => void; // Use the specific type
  onDeleteSuccess: (eventId: string) => void;
}



// Helper to parse date/time string from input fields
const parseDateTimeInput = (dateStr: string, timeStr: string): Date | null => {
    if (!dateStr || !timeStr) return null;
    try {
        // Combine date and time, then parse
        return new Date(`${dateStr}T${timeStr}`);
    } catch (e) {
        console.error("Error parsing date/time input:", e);
        return null;
    }
};

// Helper to format a Date object into YYYY-MM-DD for input fields
const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const AddEditEventDialog: React.FC<AddEditEventDialogProps> = ({
  isOpen,
  onOpenChange,
  event,
  dateRange,
  onSaveSuccess,
  onDeleteSuccess,
}) => {
  const { toast } = useToast();
  const { user } = useAuth(); // Get user from auth context
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(''); // HH:mm
  const [endDate, setEndDate] = useState('');     // YYYY-MM-DD
  const [endTime, setEndTime] = useState('');     // HH:mm
  const [description, setDescription] = useState('');
  const [isAllDay, setIsAllDay] = useState(false); // TODO: Add checkbox for all-day events
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const isEditing = !!event?.id;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && event) {
        // --- Editing Mode ---
        setTitle(event.title || '');
        setDescription(event.extendedProps?.description || '');
        setIsAllDay(event.allDay || false);
        // Initialize selected tags from event props if editing
        setSelectedTagIds(event.extendedProps?.tags?.map(tag => tag.id) || []);

        // event.start/end should be Date objects or ISO strings from FullCalendar
        const start = event.start ? new Date(event.start as string | number | Date) : new Date();
        const end = event.end ? new Date(event.end as string | number | Date) : new Date(start.getTime() + 60 * 60 * 1000); // Default to 1 hour duration

        // Use the new helper to format dates correctly, avoiding timezone shifts
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));

        if (!event.allDay) {
            // Format time as HH:mm (ensure leading zeros)
            setStartTime(start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
            setEndTime(end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        } else {
            setStartTime('');
            setEndTime('');
        }
        // Reset tags when opening in edit mode (will be set above if event has tags)
        // setSelectedTagIds(event.extendedProps?.tags?.map(tag => tag.id) || []); // Moved up

      } else if (dateRange) {
        // --- Adding Mode (from date selection) ---
        setTitle('');
        setDescription('');
        setIsAllDay(false); // Default to not all-day
        setSelectedTagIds([]); // Reset tags for new event

        const start = dateRange.start;
        // FullCalendar's select often gives end date as exclusive, adjust if needed
        const end = dateRange.end;

        // Use the new helper here as well
        setStartDate(formatDateForInput(start));
        setEndDate(formatDateForInput(end));
        // Pre-fill times based on selection or defaults
        setStartTime(start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setEndTime(end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

      } else {
        // --- Adding Mode (from button click - default values) ---
        setTitle('');
        setDescription('');
        setIsAllDay(false);
        setSelectedTagIds([]); // Reset tags for new event
        const now = new Date();
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
        // And here for default values
        setStartDate(formatDateForInput(now));
        setStartTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        setEndDate(formatDateForInput(oneHourLater));
        setEndTime(oneHourLater.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
      }
    }
  }, [isOpen, event, dateRange, isEditing]);

  // --- Fetch Available Tags ---
  useEffect(() => {
    const loadTags = async () => {
      if (!user?.id || !isOpen) return; // Only fetch if dialog is open and user exists
      try {
        const fetchedPinTags = await fetchTags(user.id, 'pin');
        const fetchedPriorityTags = await fetchTags(user.id, 'priority');
        setAvailableTags([...fetchedPinTags, ...fetchedPriorityTags]);
      } catch (err) {
        console.error("Failed to fetch tags for dialog:", err);
        toast({ title: "Error", description: "Could not load tags.", variant: "destructive" });
        setAvailableTags([]); // Ensure it's an empty array on error
      }
    };

    loadTags();
    // Reset available tags when dialog closes to avoid stale data if tags change elsewhere
    return () => {
        if (!isOpen) {
            setAvailableTags([]);
        }
    }
  }, [user?.id, isOpen, toast]); // Depend on user ID and dialog state

  // --- Tag Selection Handler ---
   const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);


  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title Required", description: "Please enter an event title.", variant: "destructive" });
      return;
    }

    const startDateTime = parseDateTimeInput(startDate, startTime);
    const endDateTime = parseDateTimeInput(endDate, endTime);

    if (!isAllDay && (!startDateTime || !endDateTime)) {
        toast({ title: "Invalid Date/Time", description: "Please enter valid start and end dates/times.", variant: "destructive" });
        return;
    }
    if (!isAllDay && startDateTime && endDateTime && startDateTime >= endDateTime) {
        toast({ title: "Invalid Date Range", description: "End time must be after start time.", variant: "destructive" });
        return;
    }

    setIsProcessing(true);

    const eventData: GoogleCalendarEventInput = {
      summary: title,
      description: description,
      start: isAllDay ? { date: startDate } : { dateTime: startDateTime?.toISOString() },
      end: isAllDay ? { date: endDate } : { dateTime: endDateTime?.toISOString() },
    };

    try {
      let savedEvent: GoogleCalendarEvent; // Use the specific type

      if (isEditing && event?.id) {
        savedEvent = await updateCalendarEvent('primary', event.id, eventData);
        toast({ title: "Success", description: "Event updated successfully!" });
      } else {
        savedEvent = await createCalendarEvent('primary', eventData);
        toast({ title: "Success", description: "Event created successfully!" });
      }

      // --- Save Tags to Supabase ---
      if (savedEvent?.id && user?.id) {
        try {
          await setTagsForCalendarEvent(user.id, savedEvent.id, selectedTagIds);
          console.log(`Tags saved successfully for event ${savedEvent.id}`);
          // Add the saved tags to the event object before calling onSaveSuccess
          const finalTags = availableTags.filter(tag => selectedTagIds.includes(tag.id));
          savedEvent.tags = finalTags; // Add tags to the event object
        } catch (tagError: any) {
          console.error("Error saving tags:", tagError);
          toast({
            title: "Warning",
            description: `Event saved, but failed to save tags: ${tagError.message}`,
            variant: "destructive", 
          });
           // Still proceed to call onSaveSuccess, but without tags or with empty tags
           savedEvent.tags = []; // Ensure tags property exists but is empty
        }
      } else {
          console.warn("Could not save tags: Missing savedEvent.id or user.id");
          savedEvent.tags = []; // Ensure tags property exists but is empty
      }

      onSaveSuccess(savedEvent); // Pass the event (potentially with tags) back
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving event:", error);
      toast({
        title: "Error Saving Event",
        description: error.message || "Could not save the event.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !event?.id) return;


    setIsDeleting(true);
    const eventIdToDelete = event.id; // Store ID before potential state changes

    try {
      // 1. Delete from Google Calendar
      await deleteCalendarEvent('primary', eventIdToDelete);
      toast({ title: "Success", description: "Event deleted from Google Calendar." });

      // 2. Delete associated tags from Supabase
      if (user?.id) {
          try {
              await deleteCalendarEventTags(user.id, eventIdToDelete);
              console.log(`Tags deleted successfully for event ${eventIdToDelete}`);
          } catch (tagDeleteError: any) {
              console.error("Error deleting associated tags:", tagDeleteError);
              toast({
                  title: "Warning",
                  description: `Event deleted, but failed to clean up tags: ${tagDeleteError.message}`,
                  variant: "destructive",
              });
              // Continue closing the dialog even if tag cleanup fails
          }
      } else {
          console.warn("Could not delete tags: Missing user.id");
      }

      // 3. Notify parent component and close dialog
      onDeleteSuccess(eventIdToDelete);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error Deleting Event",
        description: error.message || "Could not delete the event.",
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
          <DialogTitle>{isEditing ? 'Edit Event' : 'Add New Event'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modify the details below.' : 'Fill in the details for the new event.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Title */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="title" className="text-right">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className="col-span-3"
              disabled={isProcessing || isDeleting}
            />
          </div>

          {/* Start Date/Time */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startDate" className="text-right">Start</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="col-span-2"
              disabled={isProcessing || isDeleting}
            />
            {!isAllDay && (
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="col-span-1"
                disabled={isProcessing || isDeleting}
              />
            )}
          </div>

          {/* End Date/Time */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endDate" className="text-right">End</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="col-span-2"
              disabled={isProcessing || isDeleting}
            />
             {!isAllDay && (
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="col-span-1"
                disabled={isProcessing || isDeleting}
              />
             )}
          </div>

          {/* Description */}
          <div className="grid grid-cols-4 items-start gap-4"> {/* Use items-start for alignment */}
            <Label htmlFor="description" className="text-right pt-2">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description (optional)"
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
                                   {/* Use preventDefault to stop menu closing on item click */}
                                   <label htmlFor={`tag-${tag.id}`} className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer">
                                       <span className="flex items-center">
                                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }}></span>
                                            {tag.name} ({tag.type})
                                       </span>
                                       <Checkbox
                                           id={`tag-${tag.id}`}
                                           checked={selectedTagIds.includes(tag.id)}
                                           onCheckedChange={() => handleTagToggle(tag.id)}
                                           className="ml-2"
                                           aria-label={`Tag event with ${tag.name}`}
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
              {isProcessing ? 'Saving...' : 'Save Event'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddEditEventDialog;