
import React, { useState, useEffect } from 'react'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { createCard, CustomCard, CardTag } from '@/lib/cardApi';
import { fetchTags } from '@/lib/supabaseClient';
import { useAuth } from '@/components/providers/AuthProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag } from 'lucide-react';
import ScrollableDropdown from '@/components/ui/ScrollableDropdown'; // Import the new component
// Removed DropdownMenuItem import as it's no longer used

interface AddCardDialogProps {
  children: React.ReactNode;
  onCardAdded: (newCard: CustomCard) => void;
}

const AddCardDialog = ({ children, onCardAdded }: AddCardDialogProps) => { // Destructure onCardAdded
  const { user } = useAuth(); // Get user from auth context
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Loading state for form submission
  const [availableTags, setAvailableTags] = useState<CardTag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false); 
  const { toast } = useToast();

  // Fetch available tags when the dialog opens or user changes
  useEffect(() => {
    const loadTags = async () => {
      if (open && user?.id) {
        setIsLoadingTags(true); // Set loading true
        setAvailableTags([]); // Clear previous
        try {
          const pinTags = await fetchTags(user.id, 'pin');
          const priorityTags = await fetchTags(user.id, 'priority');
          setAvailableTags([...pinTags, ...priorityTags]);
        } catch (error) {
          console.error("Failed to fetch tags:", error);
          toast({ title: "Error", description: "Could not load tags.", variant: "destructive" });
          setAvailableTags([]); // Ensure empty on error
        } finally {
          setIsLoadingTags(false); // Set loading false
        }
      } else {
        // Clear tags and loading state if dialog is closed or user is missing
        setAvailableTags([]);
        setSelectedTagIds([]); // Also clear selected tags when dialog closes/user changes
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, [open, user?.id, toast]);

  const handleTagSelectionChange = (tagId: string, checked: boolean | 'indeterminate') => {
      setSelectedTagIds(prev =>
          checked === true
              ? [...prev, tagId]
              : prev.filter(id => id !== tagId)
      );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true); // Set loading true

    if (!title || !content) { // Check for title and content
      toast({
        title: "Error",
        description: "Please fill in both title and content",
        variant: "destructive",
      });
      setIsLoading(false); // Set loading false
      return;
    }
    
    try {
      // Pass selectedTagIds to createCard
      const newCard = await createCard(title, content, selectedTagIds);
      toast({
        title: "Success",
        description: `Card "${newCard.title}" added successfully.`,
      });
      onCardAdded(newCard);
      setTitle('');
      setContent('');
      setSelectedTagIds([]); // Clear selected tags
      setOpen(false);
    } catch (error) {
       console.error("Failed to add card:", error);
       const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        title: "Error Adding Card",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
       setIsLoading(false); // Set loading false
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="title">Card Title</Label>
            <Input
              id="title"
              placeholder="Enter card title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
             <Label htmlFor="content">Card Content</Label>
             <Textarea
               id="content"
               placeholder="Enter card content"
               value={content}
               onChange={(e) => setContent(e.target.value)}
               rows={4} // Adjust rows as needed
             />
           </div>
            {/* Tag Selection Dropdown */}
            <div className="space-y-2">
               <Label>Tags (Optional)</Label>
               <ScrollableDropdown // Use the new component
                 trigger={
                   <Button type="button" variant="outline" className="w-full justify-start text-left font-normal"> {/* Added type="button" */}
                     <Tag className="mr-2 h-4 w-4" />
                     {selectedTagIds.length > 0
                       ? `${selectedTagIds.length} tag(s) selected`
                       : "Select tags"}
                   </Button>
                 }
                 contentClassName="w-56" // Pass className for content
                 align="start" // Pass align prop
               >
                  {isLoadingTags ? (
                      <div className="px-2 py-1.5 text-sm opacity-50">Loading tags...</div>
                  ) : availableTags.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm opacity-50">No tags available</div>
                  ) : (
                      availableTags.map(tag => (
                          // Replaced DropdownMenuItem with a div
                          <div key={tag.id} className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm">
                              <label htmlFor={`add-tag-${tag.id}`} className="flex items-center justify-between w-full cursor-pointer"> {/* Changed id prefix */}
                                  <span>{tag.name} ({tag.type})</span>
                                  <Checkbox
                                      id={`add-tag-${tag.id}`} // Changed id prefix
                                      checked={selectedTagIds.includes(tag.id)}
                                      onCheckedChange={(checked) => handleTagSelectionChange(tag.id, checked)}
                                      className="ml-2"
                                  />
                              </label>
                          </div>
                      ))
                  )}
               </ScrollableDropdown> {/* Closed ScrollableDropdown */}
            </div>
         <div className="flex justify-end">
           <Button type="submit" className="bg-purple hover:bg-purple-dark" disabled={isLoading}>
             {isLoading ? 'Adding...' : 'Add Card'}
           </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddCardDialog;
