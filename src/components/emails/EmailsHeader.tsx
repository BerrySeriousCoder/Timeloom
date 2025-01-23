
import React, { useState, useEffect } from 'react';
import { Search, Plus, RefreshCcw, ArrowLeft, Tag, Loader2 } from 'lucide-react'; 
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label'; 
import { useToast } from '@/components/ui/use-toast'; 
import { useAuth } from '@/components/providers/AuthProvider'; 
import { fetchTags } from '@/lib/supabaseClient'; 
import { CardTag } from '@/lib/cardApi'; 
import { FilterMode } from '@/lib/tagFiltering';
import ComposeEmailDialog from './ComposeEmailDialog';
interface EmailsHeaderProps {
  isViewingThread: boolean;
  isTagView: boolean; 
}

const EmailsHeader = ({ isViewingThread, isTagView }: EmailsHeaderProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams(); 
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<CardTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const initialTags = searchParams.get('tags')?.split(',') || [];
  const initialMode = (searchParams.get('mode') as FilterMode) || 'any';
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialTags);
  const [filterMode, setFilterMode] = useState<FilterMode>(initialMode);

  // Effect to sync input with URL search param 'q'
  useEffect(() => {
    setSearchTerm(searchParams.get('q') || '');
  }, [searchParams]);

  // Fetch available tags
  useEffect(() => {
    const loadTags = async () => {
      if (!user?.id) return;
      setIsLoadingTags(true);
      try {
        const pinTags = await fetchTags(user.id, 'pin');
        const priorityTags = await fetchTags(user.id, 'priority');
        setAvailableTags([...pinTags, ...priorityTags]);
      } catch (error) {
        console.error("Failed to fetch tags for filter:", error);
        toast({ title: "Error", description: "Could not load tags for filtering.", variant: "destructive" });
        setAvailableTags([]);
      } finally {
        setIsLoadingTags(false);
      }
    };
    loadTags();
  }, [user?.id, toast]);

  // Update URL when filter changes
  useEffect(() => {
    // If viewing a thread, don't sync filter state back to the URL
    if (isViewingThread) {
      return;
    }
    const currentParams = new URLSearchParams(searchParams);
    if (selectedTagIds.length > 0) {
      currentParams.set('tags', selectedTagIds.join(','));
      currentParams.set('mode', filterMode);
    } else {
      currentParams.delete('tags');
      currentParams.delete('mode');
    }
    // Keep existing 'q' param
    const q = searchParams.get('q');
    if (q) {
        currentParams.set('q', q);
    } else {
        currentParams.delete('q'); // Ensure 'q' is removed if search term is empty
    }

    // Use replace to avoid adding multiple history entries while typing/selecting
    navigate(`/emails?${currentParams.toString()}`, { replace: true });

  }, [selectedTagIds, filterMode, navigate, searchParams, isViewingThread]);

  const handleTagSelectionChange = (tagId: string, checked: boolean | 'indeterminate') => {
      setSelectedTagIds(prev =>
          checked === true
              ? [...prev, tagId]
              : prev.filter(id => id !== tagId)
      );
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const trimmedSearch = searchTerm.trim();
      if (trimmedSearch) {
        navigate(`/emails?q=${encodeURIComponent(trimmedSearch)}`);
      } else {
        // If search is cleared, navigate back to base emails page
        navigate('/emails');
      }
    }
  };
  return (
    <div className="flex flex-col space-y-4 mb-6 bg-background dark:bg-card p-4 rounded-md border-b dark:border-muted">
      <div className="flex justify-between items-center">
        {isViewingThread ? (
          <Button variant="ghost" size="icon" onClick={() => navigate('/emails')} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Emails</span>
          </Button>
        ) : (
          <h1 className="text-2xl font-bold font-bebas">Emails</h1>
        )}
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('refreshEmails'));
            }}
            disabled={isTagView} 
            title={isTagView ? "Refresh disabled in tag view" : "Refresh emails"} 
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
          
          <ComposeEmailDialog>
            <Button className="bg-purple hover:bg-purple/90">
              <Plus className="mr-2 h-4 w-4" /> Compose
            </Button>
          </ComposeEmailDialog>
        </div>
      </div>
      {!isViewingThread && (
        <div className="flex space-x-2 items-center">
          <div className="relative flex-grow">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search emails..."
              className="pl-9 w-full"
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {searchParams.get('q') && (
            <Button
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/emails')}
              className="text-muted-foreground hover:text-foreground" 
            >
              Clear 
            </Button>
          )}
          {/* Tag Filter Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <Tag className="mr-2 h-4 w-4" />
                {selectedTagIds.length > 0 ? `${selectedTagIds.length} Tag(s)` : "Filter by Tag"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {isLoadingTags ? (
                <DropdownMenuItem disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                </DropdownMenuItem>
              ) : availableTags.length === 0 ? (
                <DropdownMenuItem disabled>No tags available</DropdownMenuItem>
              ) : (
                availableTags.map(tag => (
                  <DropdownMenuItem key={tag.id} onSelect={(e) => e.preventDefault()} className="p-0">
                    <label htmlFor={`filter-tag-${tag.id}`} className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer">
                      <span>{tag.name} ({tag.type})</span>
                      <Checkbox
                        id={`filter-tag-${tag.id}`}
                        checked={selectedTagIds.includes(tag.id)}
                        onCheckedChange={(checked) => handleTagSelectionChange(tag.id, checked)}
                        className="ml-2"
                      />
                    </label>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter Mode Switch (only show if tags are selected) */}
          {selectedTagIds.length > 0 && (
            <div className="flex items-center space-x-2 flex-shrink-0 border border-input bg-background rounded-md px-3 py-1 h-9">
              <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                Any
              </Label>
              <Switch
                id="filter-mode-toggle"
                checked={filterMode === 'all'}
                onCheckedChange={(checked) => setFilterMode(checked ? 'all' : 'any')}
                aria-label="Toggle between matching any tag or all tags"
                className="h-4 w-7 [&>span]:h-3 [&>span]:w-3" // Adjusted size
              />
              <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                All
              </Label>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailsHeader;
