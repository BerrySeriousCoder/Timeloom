import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { CustomCard, updateCard, deleteCard, CardTag } from '@/lib/cardApi';
import { useToast } from '@/components/ui/use-toast';
import { Trash2, Edit, Tag, Loader2, Mail, Calendar, List } from 'lucide-react'; 
import { fetchTags } from '@/lib/supabaseClient';
import { useAuth } from '@/components/providers/AuthProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import ScrollableDropdown from '@/components/ui/ScrollableDropdown'; // Import the new component
// Removed DropdownMenu, DropdownMenuContent, DropdownMenuTrigger imports
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"; 
import {
    FilterMode,
    fetchEmailsByTags,
    fetchCalendarEventsByTags,
    fetchTimelineCustomCardsByTags,
    Email,
    CalendarEvent,
    TimelineCustomCard
} from '@/lib/tagFiltering';

interface CustomCardProps {
  card: CustomCard;
  onUpdate: (updatedCard: CustomCard) => void;
  onDelete: (id: string) => void;
  className?: string; // Allow passing className for styling
}

const CustomCardComponent: React.FC<CustomCardProps> = ({ card, onUpdate, onDelete, className }) => {
  const { user } = useAuth();
  const navigate = useNavigate(); 
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editContent, setEditContent] = useState(card.content);
  const [editTagIds, setEditTagIds] = useState<string[]>(card.tags.map(t => t.id)); 
  const [availableTags, setAvailableTags] = useState<CardTag[]>([]); 
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [isLoadingTags, setIsLoadingTags] = useState(false);

  // State for tag-based filtering
  const [filterMode, setFilterMode] = useState<FilterMode>('any');
  const [filteredEmails, setFilteredEmails] = useState<Email[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
  const [filteredTimelineCards, setFilteredTimelineCards] = useState<TimelineCustomCard[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [errorEmails, setErrorEmails] = useState<string | null>(null);
  const [errorEvents, setErrorEvents] = useState<string | null>(null);
  const [errorTimeline, setErrorTimeline] = useState<string | null>(null);

  // Fetch available tags when the edit dialog opens
  useEffect(() => {
    const loadTags = async () => {
      if (isEditing && user?.id) {
        setIsLoadingTags(true); // Set loading true before fetch
        setAvailableTags([]); // Clear previous tags
        try {
          const pinTags = await fetchTags(user.id, 'pin');
          const priorityTags = await fetchTags(user.id, 'priority');
          setAvailableTags([...pinTags, ...priorityTags]);
        } catch (error) {
          console.error("Failed to fetch tags for editing:", error);
          toast({ title: "Error", description: "Could not load tags.", variant: "destructive" });
          setAvailableTags([]); // Ensure empty on error
        } finally {
          setIsLoadingTags(false); // Set loading false after fetch completes
        }
      } else {
         // If dialog is closed or user is not available, ensure loading is false and tags are clear
         setIsLoadingTags(false);
         setAvailableTags([]);
      }
    };
    loadTags();
  }, [isEditing, user?.id, toast]);

  // Reset edit state when dialog closes or card changes
  useEffect(() => {
      setEditTitle(card.title);
      setEditContent(card.content);
      setEditTagIds(card.tags.map(t => t.id));
  }, [card, isEditing]); // Reset if card data changes or dialog re-opens


  const handleEditTagSelectionChange = (tagId: string, checked: boolean | 'indeterminate') => {
      setEditTagIds(prev =>
          checked === true
              ? [...prev, tagId]
              : prev.filter(id => id !== tagId)
      );
  };


  const handleUpdate = async () => {
    if (!editTitle || !editContent) {
      toast({ title: "Error", description: "Title and content cannot be empty.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    try {
      // Pass editTagIds to updateCard
      const updatedCardData = await updateCard(card.id, editTitle, editContent, editTagIds);
      // The API returns the card without tags populated immediately,
      // so we manually merge the updated tags for the callback if needed,
      // or rely on the parent component re-fetching.
      onUpdate({ ...updatedCardData, tags: availableTags.filter(t => editTagIds.includes(t.id)) }); // Pass updated card with tags
      toast({ title: "Success", description: "Card updated successfully." });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update card:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ title: "Error Updating Card", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteCard(card.id);
      onDelete(card.id); // Update state in parent
      toast({ title: "Success", description: "Card deleted successfully." });
      // No need to close dialog as delete is usually direct
    } catch (error) {
      console.error("Failed to delete card:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({ title: "Error Deleting Card", description: errorMessage, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Effect to fetch data based on tags and filter mode
  useEffect(() => {
    const currentTagIds = card.tags.map(t => t.id);
    if (currentTagIds.length === 0) {
      // Clear data if no tags are assigned to the card
      setFilteredEmails([]);
      setFilteredEvents([]);
      setFilteredTimelineCards([]);
      setErrorEmails(null);
      setErrorEvents(null);
      setErrorTimeline(null);
      return; // Don't fetch if no tags
    }

    const fetchData = async () => {
      // Fetch Emails
      setIsLoadingEmails(true);
      setErrorEmails(null);
      try {
        const emails = await fetchEmailsByTags(currentTagIds, filterMode);
        setFilteredEmails(emails);
      } catch (err) {
        console.error("Failed to fetch emails by tags:", err);
        setErrorEmails(err instanceof Error ? err.message : "Failed to load emails");
        setFilteredEmails([]); // Clear data on error
      } finally {
        setIsLoadingEmails(false);
      }

      // Fetch Calendar Events
      setIsLoadingEvents(true);
      setErrorEvents(null);
      try {
        // TODO: This function needs implementation based on Calendar source
        const events = await fetchCalendarEventsByTags(currentTagIds, filterMode);
        setFilteredEvents(events);
      } catch (err) {
        console.error("Failed to fetch calendar events by tags:", err);
        setErrorEvents(err instanceof Error ? err.message : "Failed to load calendar events");
        setFilteredEvents([]); // Clear data on error
      } finally {
        setIsLoadingEvents(false);
      }

      // Fetch Timeline Custom Cards
      setIsLoadingTimeline(true);
      setErrorTimeline(null);
      try {
        const timelineCards = await fetchTimelineCustomCardsByTags(currentTagIds, filterMode);
        setFilteredTimelineCards(timelineCards);
      } catch (err) {
        console.error("Failed to fetch project custom cards by tags:", err);
        setErrorTimeline(err instanceof Error ? err.message : "Failed to load project items");
        setFilteredTimelineCards([]); // Clear data on error
      } finally {
        setIsLoadingTimeline(false);
      }
    };

    fetchData();

  }, [card.tags, filterMode]); // Re-run when tags or filter mode change (removed toast)

  return (
    <Card className={`flex flex-col h-full ${className}`}> 
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-lg font-medium truncate font-dmSans">{card.title}</CardTitle>
        <div className="flex items-center space-x-1">
           {/* Edit Dialog Trigger */}
           <Dialog open={isEditing} onOpenChange={setIsEditing}>
             <DialogTrigger asChild>
               <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:text-primary">
                 <Edit className="w-4 h-4" />
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle className="font-dmSans">Edit Card</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <Label htmlFor="edit-title">Title</Label>
                   <Input
                     id="edit-title"
                     value={editTitle}
                     onChange={(e) => setEditTitle(e.target.value)}
                     placeholder="Card Title"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label htmlFor="edit-content">Content</Label>
                   <Textarea
                     id="edit-content"
                     value={editContent}
                     onChange={(e) => setEditContent(e.target.value)}
                     placeholder="Card Content"
                     rows={5}
                   />
                 </div>
                  {/* Tag Selection Dropdown */}
                  <div className="space-y-2">
                     <Label>Tags</Label>
                     <ScrollableDropdown // Use the new component
                       trigger={
                         <Button type="button" variant="outline" className="w-full justify-start text-left font-normal"> {/* Added type="button" */}
                           <Tag className="mr-2 h-4 w-4" />
                           {editTagIds.length > 0
                             ? `${editTagIds.length} tag(s) selected`
                             : "Select tags"}
                         </Button>
                       }
                       contentClassName="w-56" // Pass className for content
                       align="start" // Pass align prop
                     >
                        {isLoadingTags ? (
                            // Replaced DropdownMenuItem with a div
                            <div className="px-2 py-1.5 text-sm opacity-50">Loading tags...</div>
                        ) : availableTags.length === 0 ? (
                            // Replaced DropdownMenuItem with a div
                            <div className="px-2 py-1.5 text-sm opacity-50">No tags available</div>
                        ) : (
                            availableTags.map(tag => (
                                // Replaced DropdownMenuItem with a div
                                <div key={tag.id} className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm">
                                    <label htmlFor={`edit-tag-${tag.id}`} className="flex items-center justify-between w-full cursor-pointer">
                                        <span>{tag.name} ({tag.type})</span>
                                        <Checkbox
                                            id={`edit-tag-${tag.id}`}
                                            checked={editTagIds.includes(tag.id)}
                                            onCheckedChange={(checked) => handleEditTagSelectionChange(tag.id, checked)}
                                            className="ml-2"
                                        />
                                    </label>
                                </div>
                            ))
                        )}
                     </ScrollableDropdown> {/* Closed ScrollableDropdown */}
                  </div>
               </div>
               <DialogFooter>
                 <DialogClose asChild>
                    {/* Reset state on cancel */}
                    <Button variant="outline" onClick={() => { setIsEditing(false); /* State reset handled by useEffect */ }}>Cancel</Button>
                 </DialogClose>
                 <Button onClick={handleUpdate} disabled={isUpdating || !editTitle || !editContent}>
                   {isUpdating ? 'Saving...' : 'Save Changes'}
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>

           {/* Delete Button */}
           <Button
             variant="ghost"
             size="icon"
             className="w-6 h-6 text-muted-foreground hover:text-destructive"
             onClick={handleDelete}
             disabled={isDeleting}
           >
             {isDeleting ? <div className="w-4 h-4 border-2 border-t-transparent border-destructive rounded-full animate-spin"></div> : <Trash2 className="w-4 h-4" />}
           </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-grow overflow-auto space-y-4"> {/* Added space-y-4 */}
        {/* Card Description */}
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.content}</p>

        {/* Filter Controls - Only show if card has tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="border-t pt-3 mt-3 space-y-3">
             <div className="flex items-center justify-between">
                <Label htmlFor="filter-mode-toggle" className="text-sm font-medium">
                    Filter Items:
                </Label>
                <div className="flex items-center space-x-2">
                     <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                        Match Any Tag
                     </Label>
                     <Switch
                        id="filter-mode-toggle"
                        checked={filterMode === 'all'}
                        onCheckedChange={(checked) => setFilterMode(checked ? 'all' : 'any')}
                        aria-label="Toggle between matching any tag or all tags"
                     />
                     <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                        Match All Tags
                     </Label>
                </div>
             </div>

            {/* Data Display Accordion */}
            <Accordion type="multiple" className="w-full">
              {/* Emails Section */}
              <AccordionItem value="emails">
                <AccordionTrigger>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4" />
                    <span>Emails ({isLoadingEmails ? '...' : filteredEmails.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isLoadingEmails && <Loader2 className="h-4 w-4 animate-spin mx-auto my-2" />}
                  {errorEmails && <p className="text-xs text-destructive px-4 py-2 font-mulish">Error: {errorEmails}</p>}
                  {!isLoadingEmails && !errorEmails && filteredEmails.length === 0 && (
                    <p className="text-xs text-muted-foreground px-4 py-2 font-mulish">No emails found matching {filterMode === 'all' ? 'all' : 'any'} selected tag(s).</p>
                  )}
                  {!isLoadingEmails && !errorEmails && filteredEmails.length > 0 && (
                    <ul className="text-xs space-y-2 max-h-40 overflow-y-auto px-4 py-1"> {/* Increased space-y */}
                      {filteredEmails.map(email => (
                        <li
                          key={email.email_id}
                          className="border-b border-dashed pb-1 last:border-b-0 cursor-pointer hover:bg-accent p-1 rounded"
                          onClick={() => {
                              // Removed console.log
                              if (email.thread_id) {
                                  navigate(`/emails/thread/${email.thread_id}`); // Corrected route
                              } else {
                                  // Optionally show a toast or alert here? For now, just prevents navigation.
                                  console.warn('Navigation skipped: thread_id is missing for email', email.email_id);
                              }
                          }}
                          title={email.thread_id ? `View email thread: ${email.subject || ''}` : 'Cannot navigate (missing thread ID)'}
                        >
                          <p className="font-medium truncate font-dmSans">{email.subject || '(No Subject)'}</p>
                          <p className="text-muted-foreground truncate font-mulish">From: {email.from || '(Unknown Sender)'}</p>
                          <p className="text-muted-foreground text-[11px] font-mulish">{email.snippet || '(No snippet)'}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Calendar Events Section */}
              <AccordionItem value="calendar-events">
                <AccordionTrigger>
                   <div className="flex items-center space-x-2">
                     <Calendar className="h-4 w-4" />
                     <span>Calendar Events ({isLoadingEvents ? '...' : filteredEvents.length})</span>
                   </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isLoadingEvents && <Loader2 className="h-4 w-4 animate-spin mx-auto my-2" />}
                  {errorEvents && <p className="text-xs text-destructive px-4 py-2 font-mulish">Error: {errorEvents}</p>}
                  {!isLoadingEvents && !errorEvents && filteredEvents.length === 0 && (
                    <p className="text-xs text-muted-foreground px-4 py-2 font-mulish">No calendar events found matching {filterMode === 'all' ? 'all' : 'any'} selected tag(s).</p>
                  )}
                  {!isLoadingEvents && !errorEvents && filteredEvents.length > 0 && (
                    <ul className="text-xs space-y-2 max-h-40 overflow-y-auto px-4 py-1"> {/* Increased space-y */}
                      {filteredEvents.map(event => {
                        const startDate = event.start?.dateTime || event.start?.date;
                        const endDate = event.end?.dateTime || event.end?.date;
                        const isAllDay = !!event.start?.date; // Check if it's an all-day event

                        const formatOptions: Intl.DateTimeFormatOptions = isAllDay
                          ? { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' } // Show date only for all-day, ensure UTC
                          : { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }; // Show date and time

                        const formatDateTime = (dateStr: string | undefined) => {
                            if (!dateStr) return 'N/A';
                            try {
                                return new Date(dateStr).toLocaleString(undefined, formatOptions);
                            } catch {
                                return dateStr; // Fallback to original string if parsing fails
                            }
                        };

                        return (
                          <li
                            key={event.id}
                            className="border-b border-dashed pb-1 last:border-b-0 cursor-pointer hover:bg-accent p-1 rounded"
                            onClick={() => navigate('/calendar')} 
                            title={`View event in Calendar: ${event.summary || ''}`}
                          >
                            <p className="font-medium truncate font-dmSans">{event.summary || '(No Title)'}</p>
                            <p className="text-muted-foreground text-[11px] font-mulish">
                              {formatDateTime(startDate)}
                              {endDate && startDate !== endDate ? ` - ${formatDateTime(endDate)}` : ''}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Project Custom Cards Section */}
              <AccordionItem value="project-items"> 
                <AccordionTrigger>
                   <div className="flex items-center space-x-2">
                     <List className="h-4 w-4" />
                     <span>Project Items ({isLoadingTimeline ? '...' : filteredTimelineCards.length})</span>
                   </div>
                </AccordionTrigger>
                <AccordionContent>
                  {isLoadingTimeline && <Loader2 className="h-4 w-4 animate-spin mx-auto my-2" />}
                  {errorTimeline && <p className="text-xs text-destructive px-4 py-2 font-mulish">Error: {errorTimeline}</p>}
                  {!isLoadingTimeline && !errorTimeline && filteredTimelineCards.length === 0 && (
                    <p className="text-xs text-muted-foreground px-4 py-2 font-mulish">No project items found matching {filterMode === 'all' ? 'all' : 'any'} selected tag(s).</p>
                  )}
                  {!isLoadingTimeline && !errorTimeline && filteredTimelineCards.length > 0 && (
                    <ul className="text-xs space-y-2 max-h-40 overflow-y-auto px-4 py-1"> 
                      {filteredTimelineCards.map(item => {
                         const formatDate = (dateStr: string | undefined | null) => {
                            if (!dateStr) return '';
                            try {
                                // Assuming YYYY-MM-DD format from schema
                                return new Date(dateStr + 'T00:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
                            } catch {
                                return dateStr;
                            }
                         };
                         const startDateFormatted = formatDate(item.start_date);
                         const endDateFormatted = formatDate(item.end_date);

                         return (
                            <li
                              key={item.id}
                              className="border-b border-dashed pb-1 last:border-b-0 cursor-pointer hover:bg-accent p-1 rounded"
                              onClick={() => navigate('/timeline')} 
                              title={`View item in Project: ${item.title}`}
                            >
                              <p className="font-medium truncate font-dmSans">{item.title}</p>
                              {item.description && <p className="text-muted-foreground text-[11px] truncate font-mulish">{item.description}</p>}
                              <p className="text-muted-foreground text-[11px] font-mulish">
                                {startDateFormatted}
                                {endDateFormatted && startDateFormatted !== endDateFormatted ? ` - ${endDateFormatted}` : ''}
                              </p>
                            </li>
                         );
                      })}
                    </ul>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </CardContent>      
       <CardFooter className="text-xs text-muted-foreground pt-2 flex justify-between items-center">
         <span> 
           Created: {new Date(card.created_at).toLocaleDateString()}
         </span>
         {card.tags && card.tags.length > 0 && (
           <div className="flex flex-wrap gap-1 justify-end"> {/* Align tags to the right */}
             {card.tags.map((tag: CardTag) => (
               <Badge
                 key={tag.id}
                 variant="secondary"
                 className=" font-semibold text-sm px-1.5 py-0.5 text-black"
                 style={{ backgroundColor: tag.color }}
               >
                 {tag.name}
               </Badge>
             ))}
           </div>
         )}
       </CardFooter>
    </Card>
  );
};

// Helper function to determine text color based on background (simple version)

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#000000'; // Default to black if color is missing
  // Simple brightness check (adjust threshold as needed)
  try {
    const r = parseInt(hexColor.substring(1, 3), 16);
    const g = parseInt(hexColor.substring(3, 5), 16);
    const b = parseInt(hexColor.substring(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155 ? '#000000' : '#FFFFFF'; // Black text on light, white text on dark
  } catch (e) {
    return '#000000'; // Fallback to black on error
  }
}


export default CustomCardComponent;
