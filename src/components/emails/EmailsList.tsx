import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import {
  fetchEmailMetadataPage,
  fetchFullEmailDetails,
  fetchSupabaseEmailData,
  updateSupabaseEmail,
  SupabaseEmailData,
  GmailFullMessage,
  fetchEmailIdsAndThreadIdsByTag,
  TaggedEmailIdentifier,
  searchGmailMessages,
  fetchTags,
  addTagToEmail,
  removeTagFromEmail,
  fetchImportantEmailMetadataPage, 
  markEmailStarred
} from '@/lib/supabaseClient';
import { fetchEmailsByTags, FilterMode, Email as FilteredEmailType } from '@/lib/tagFiltering'; 
import { useAuth } from '@/components/providers/AuthProvider';
import { EmailListItem } from './EmailListItem'; 
import { Star, Loader2, Tag, ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { useToast } from '@/components/ui/use-toast';
import { PaginationControls } from './PaginationControls';

// --- Types ---
interface EmailItem {
  id: string;
  threadId: string;
  subject: string;
  sender: string;
  senderAddress: string;
  excerpt: string;
  date: string;
  dateObj: Date;
  read: boolean;
  starred: boolean;
  tags: { id: string; name: string; color: string; type: string }[];
}

// --- Helper Components ---

const EmailListToolbar = ({
  activeTab,
  onTabChange,
  selectAll,
  onSelectAll,
  isLoading,
  hasEmails,
}: {
  activeTab: string;
  onTabChange: (value: string) => void;
  selectAll: boolean;
  onSelectAll: (checked: boolean) => void;
  isLoading: boolean;
  hasEmails: boolean;
}) => {
  return (
    <div className="mb-4 bg-background sticky top-0 z-10 pb-2 border-b dark:border-muted">
      <div className="flex items-center space-x-2 mb-4 px-4 pt-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Checkbox
                checked={selectAll}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                disabled={isLoading || !hasEmails}
                aria-label="Select all emails on current page"
              />
            </TooltipTrigger>
            <TooltipContent>Select all</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full px-4">
        <TabsList className="grid grid-cols-4 w-fit"> {/* Updated grid columns */}
          <TabsTrigger value="all" disabled={isLoading}>
            All
          </TabsTrigger>
          <TabsTrigger value="unread" disabled={isLoading}>
            Unread
          </TabsTrigger>
          <TabsTrigger value="starred" disabled={isLoading}>
            Starred
          </TabsTrigger>
          <TabsTrigger value="important" disabled={isLoading}> {/* Added Important tab */}
            Important
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};



// --- Helper Functions ---
const parseSender = (fromHeader: string): { name: string; address: string } => {
  if (!fromHeader) return { name: 'Unknown Sender', address: '' };
  const match = fromHeader.match(/(.*)<(.*)>/);
  if (match && match[1] && match[2]) {
    return { name: match[1].trim().replace(/"/g, ''), address: match[2].trim() };
  }
  if (fromHeader.includes('@')) {
    return { name: fromHeader, address: fromHeader };
  }
  return { name: fromHeader.trim().replace(/"/g, ''), address: '' };
};

const parseDate = (dateHeader: string): Date => {
  try {
    return new Date(dateHeader);
  } catch (e) {
    console.warn(`Could not parse date: ${dateHeader}`);
    return new Date(0);
  }
};

const formatDate = (date: Date): string => {
  if (date.getTime() === 0) return 'Invalid Date';
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
};

const getHeader = (headers: { name: string; value: string }[], name: string): string => {
  const header = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
};

// --- Main Component ---
const EmailsList = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const params = useParams<{ threadId?: string }>(); // Get URL params including optional threadId
  const { toast } = useToast();
  const nav = useNavigate();

  // State
  const [allEmails, setAllEmails] = useState<EmailItem[]>([]);
  const [emailCache, setEmailCache] = useState<Map<string, EmailItem>>(new Map());
  const [pageToken, setPageToken] = useState<string | null | undefined>(undefined);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [prevPageTokens, setPrevPageTokens] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; type: string; color: string }[]>([]);

  // URL params
  const tagFilter = searchParams.get('tag'); 
  const priorityFilter = searchParams.get('priority'); 
  const activeFilterName = tagFilter || priorityFilter; 
  const isTagView = !!activeFilterName;
  const searchQuery = searchParams.get('q');
  const isSearchView = !!searchQuery;
  const filterTagsParam = searchParams.get('tags'); 
  const filterModeParam = (searchParams.get('mode') as FilterMode) || 'any'; 
  const isNewTagFilterView = !!filterTagsParam; 
  // Refs
  const pageTokenRef = useRef(pageToken);
  const activeFilterNameRef = useRef(activeFilterName);
  const searchQueryRef = useRef(searchQuery);
  const filterTagsParamRef = useRef(filterTagsParam); 

  // Process and merge emails (used for non-new-filter views)
  const processAndMergeEmails = useCallback(
    (
      messageIds: string[],
      fetchedGmailMessages: GmailFullMessage[],
      supabaseData: SupabaseEmailData[],
      currentCache: Map<string, EmailItem>
    ): { processedEmails: EmailItem[]; updatedCache: Map<string, EmailItem> } => {
      const supabaseMap = new Map<string, SupabaseEmailData>(supabaseData.map((d) => [d.email_id, d]));
      const newCacheEntries = new Map<string, EmailItem>();

      fetchedGmailMessages.forEach((msg) => {
        if (!msg) return;
        const supabaseDetail = supabaseMap.get(msg.id);
        const senderInfo = parseSender(getHeader(msg.payload?.headers, 'From'));
        const dateObj = parseDate(getHeader(msg.payload?.headers, 'Date'));
        const emailItem: EmailItem = {
          id: msg.id,
          threadId: msg.threadId,
          subject: getHeader(msg.payload?.headers, 'Subject') || '(No Subject)',
          sender: senderInfo.name,
          senderAddress: senderInfo.address,
          date: formatDate(dateObj),
          dateObj: dateObj,
          excerpt: msg.snippet || '',
          read: !(msg.labelIds?.includes('UNREAD') ?? true),
          starred: supabaseDetail?.is_starred ?? false,
          tags: supabaseDetail?.tags ?? [],
        };
        newCacheEntries.set(msg.id, emailItem);
      });

      const updatedCache = new Map([...currentCache, ...newCacheEntries]);
      const processedEmails = messageIds
        .map((id) => updatedCache.get(id))
        .filter((email): email is EmailItem => email !== undefined);

      return { processedEmails, updatedCache };
    },
    []
  );

  // Data fetching
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setAllEmails([]);
      setEmailCache(new Map());
      setPageToken(undefined);
      setNextPageToken(null);
      setPrevPageTokens([]);
      setError(null);
      setSelectedEmails([]);
      setSelectAll(false);
      return;
    }

    const fetchController = new AbortController();
    const { signal } = fetchController;

    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      // If a threadId is present in the URL, we are navigating to/viewing a thread,
      // so the list component should not fetch data.
      if (params.threadId) {
        // console.log('EmailsList: Detected threadId in params, skipping data load.');
        setIsLoading(false); // Ensure loading state is reset if it was true
        return;
      }

      try {
        let messageIds: string[] = [];
        let fetchedEmailsResult: EmailItem[] = [];
        let finalCache = emailCache; // Start with current cache, might be updated

        const isPaging = pageToken !== pageTokenRef.current && pageToken !== undefined;
        if (!isPaging) {
          setNextPageToken(null);
          setPrevPageTokens([]);
        }

        // Prioritize the new multi-tag filter from the header
        if (isNewTagFilterView && filterTagsParam) {
          // --- New Tag Filter View (from Header Dropdown) ---
          setPageToken(null); // No pagination for this view
          setNextPageToken(null);
          setPrevPageTokens([]);

          const tagIds = filterTagsParam.split(',');
          // 1. Fetch email details based on tags
          const fetchedFilteredEmails = await fetchEmailsByTags(tagIds, filterModeParam);
          if (signal.aborted) return;

          if (fetchedFilteredEmails.length > 0) {
            const filteredEmailIds = fetchedFilteredEmails.map(fe => fe.email_id);
            // 2. Fetch Supabase data (including tags) for these specific emails
            const supabaseData = await fetchSupabaseEmailData(user.id, filteredEmailIds);
            if (signal.aborted) return;
            const supabaseMap = new Map<string, SupabaseEmailData>(supabaseData.map((d) => [d.email_id, d]));

            const newCacheEntries = new Map<string, EmailItem>();
            // 3. Map to EmailItem, merging Supabase tags
            fetchedEmailsResult = fetchedFilteredEmails.map(fe => {
              const supabaseDetail = supabaseMap.get(fe.email_id);
              const emailItem: EmailItem = {
                id: fe.email_id,
                threadId: fe.thread_id || '',
                subject: fe.subject || '(No Subject)',
                sender: parseSender(fe.from || '').name,
                senderAddress: parseSender(fe.from || '').address,
                excerpt: fe.snippet || '',
                date: fe.date ? formatDate(parseDate(fe.date)) : 'N/A',
                dateObj: fe.date ? parseDate(fe.date) : new Date(0),
                read: true, 
                starred: fe.is_starred ?? false,
                tags: supabaseDetail?.tags ?? [], 
              };
              newCacheEntries.set(emailItem.id, emailItem); 
              return emailItem;
            });
            // 4. Update the main cache
            finalCache = new Map([...emailCache, ...newCacheEntries]);
          } else {
            fetchedEmailsResult = []; // No emails found for the filter
            finalCache = emailCache; // Keep existing cache
          }

        // Fallback to search view if new filter isn't active
        } else if (isSearchView && searchQuery) {
          setPageToken(null);
          setNextPageToken(null);
          setPrevPageTokens([]);

          const searchResult = await searchGmailMessages(searchQuery);
          if (signal.aborted) return;

          if (!searchResult.messages || searchResult.messages.length === 0) {
            setAllEmails([]);
            setIsLoading(false);
            return;
          }
          messageIds = searchResult.messages.map((m) => m.id);

        // Fallback to old single-tag view if search isn't active
        } else if (isTagView && activeFilterName) {
          setPageToken(null);
          setNextPageToken(null);
          setPrevPageTokens([]);

          const tagIdentifiers = await fetchEmailIdsAndThreadIdsByTag(user.id, activeFilterName);
          if (signal.aborted) return;

          if (!tagIdentifiers || tagIdentifiers.length === 0) {
            setAllEmails([]);
            setIsLoading(false);
            return;
          }
          messageIds = tagIdentifiers.map((m) => m.email_id);

        // Default to paginated view (All, Unread, Starred, Important)
        } else {
          let metadataResult; // Declare outside the blocks
          // Fetch the base page data regardless of the 'all', 'unread', or 'starred' tab.
          if (activeTab === 'important') {
            metadataResult = await fetchImportantEmailMetadataPage(pageToken, 20);
          } else {
            // Fetch standard page for 'all', 'unread', 'starred'
            metadataResult = await fetchEmailMetadataPage(pageToken, 20);
          }

          if (signal.aborted) return;

          // Use metadataResult consistently
          messageIds = metadataResult.messages.map((m) => m.id);
          setNextPageToken(metadataResult.nextPageToken || null);

          // Check if the result is empty *after* setting the token
          if (!metadataResult.messages || metadataResult.messages.length === 0) {
            setAllEmails([]);
            // Don't return here if it's just an empty page, allow processing below
            // setIsLoading(false); // Loading state handled in finally block
            // return;
          }
        }

        // --- Common Logic for Search, Old Tag, and Paginated Views ---
        // (Skip if using the new multi-tag filter, as data is already processed)
        if (!isNewTagFilterView && messageIds.length > 0) {
          const idsToFetchDetails = messageIds.filter((id) => !emailCache.has(id));
          let fetchedGmailMessages: GmailFullMessage[] = [];
          if (idsToFetchDetails.length > 0) {
            fetchedGmailMessages = await fetchFullEmailDetails(idsToFetchDetails);
            if (signal.aborted) return;
          }

          const supabaseData = await fetchSupabaseEmailData(user.id, messageIds);
          if (signal.aborted) return;

          const { processedEmails, updatedCache } = processAndMergeEmails(
            messageIds,
            fetchedGmailMessages,
            supabaseData,
            emailCache // Pass the cache *before* this page's potential updates
          );
          fetchedEmailsResult = processedEmails;
          finalCache = updatedCache; // Get the updated cache from processing
        } else if (!isNewTagFilterView) {
          // Handle case where search/tag/page returns 0 results explicitly
           fetchedEmailsResult = [];
           finalCache = emailCache; // Keep existing cache
        }

        // --- Update State (Common) ---
        if (!signal.aborted) {
          setAllEmails(fetchedEmailsResult);
          setEmailCache(finalCache); // Update cache for all views now
        }

        // Clear selection ONLY when filter/page/search/new filter changes, not on refreshKey change alone
        if (
          pageToken !== pageTokenRef.current ||
          activeFilterName !== activeFilterNameRef.current ||
          searchQuery !== searchQueryRef.current ||
          filterTagsParam !== filterTagsParamRef.current // Check if new filter params changed
        ) {
          setSelectedEmails([]);
          setSelectAll(false);
        }

      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load emails.');
          setAllEmails([]); // Clear emails on error
          if (err.message === 'Google API token expired') {
            nav('/auth');
          }
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    // Update refs for next comparison
    pageTokenRef.current = pageToken;
    activeFilterNameRef.current = activeFilterName;
    searchQueryRef.current = searchQuery;
    filterTagsParamRef.current = filterTagsParam; 

    // Cleanup function to abort fetch on unmount or dependency change
    return () => {
      fetchController.abort();
    };
  // React to changes in authentication, user, page token, active tag filter, search query, NEW filter params, OR refresh key
  }, [
    isAuthenticated, user?.id, pageToken,
    activeFilterName, isTagView, // Old tag view params
    searchQuery, isSearchView, // Search params
    filterTagsParam, filterModeParam, isNewTagFilterView, // New filter params
    activeTab, // Added activeTab dependency
    processAndMergeEmails, refreshKey,
    params // Added params dependency
  ]);

  // Fetch available tags
  useEffect(() => {
    const loadTags = async () => {
      if (!user?.id) return;
      try {
        const fetchedPinTags = await fetchTags(user.id, 'pin');
        const fetchedPriorityTags = await fetchTags(user.id, 'priority');
        // Assuming fetchTags returns color, adjust if needed
        setAvailableTags([...fetchedPinTags, ...fetchedPriorityTags]);
      } catch (err) {
        console.error("Failed to fetch tags:", err);
        toast({ title: "Error fetching tags", description: (err as Error).message, variant: "destructive" });
      }
    };
    loadTags();
  }, [user?.id, toast]);

  // Filter emails based on the active tab (All, Unread, Starred)
  const filteredEmails = useMemo(() => {
    // Apply tab filtering *after* the main data fetching based on URL params
    const sourceEmails = allEmails; // Use the emails fetched based on URL filters
    if (activeTab === 'unread') {
      return sourceEmails.filter((email) => !email.read);
    }
    if (activeTab === 'starred') {
      return sourceEmails.filter((email) => email.starred);
    }
    return sourceEmails; // 'all' tab
  }, [allEmails, activeTab]);

  // Update selectAll state based on filtered emails
  useEffect(() => {
    if (filteredEmails.length > 0 && selectedEmails.length === filteredEmails.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedEmails, filteredEmails]);

  // --- Event Handlers ---
  const toggleStar = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    if (!user?.id) return;

    const emailToUpdate = emailCache.get(id);
    if (!emailToUpdate) {
        console.warn(`Email ${id} not found in cache for starring.`);
        toast({ title: "Error", description: "Could not find email data to update star.", variant: "destructive" });
        return;
    }

    const newStarredState = !emailToUpdate.starred;

    setEmailCache((prevCache) => {
      const newCache = new Map(prevCache);
      const currentEmail = newCache.get(id);
      if (currentEmail) {
        newCache.set(id, { ...currentEmail, starred: newStarredState });
      }
      return newCache;
    });
    // Update allEmails state as well to reflect in the list immediately
    setAllEmails((prevEmails) =>
      prevEmails.map((e) => (e.id === id ? { ...e, starred: newStarredState } : e))
    );


    try {
      await markEmailStarred(user.id, id, newStarredState);
    } catch (err) {
      console.error('Failed to update star status:', err);
      toast({ title: "Error updating star", description: (err as Error).message, variant: "destructive" });
      setEmailCache((prevCache) => {
        const newCache = new Map(prevCache);
        const currentEmail = newCache.get(id);
        if (currentEmail) {
          newCache.set(id, { ...currentEmail, starred: !newStarredState }); 
        }
        return newCache;
      });
       setAllEmails((prevEmails) =>
         prevEmails.map((e) => (e.id === id ? { ...e, starred: !newStarredState } : e)) 
       );
    }
  };

  const toggleEmailSelection = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    setSelectedEmails((prevSelected) =>
      prevSelected.includes(id) ? prevSelected.filter((emailId) => emailId !== id) : [...prevSelected, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedEmails(filteredEmails.map((email) => email.id));
    } else {
      setSelectedEmails([]);
    }
  };

  const handleTagToggle = async (emailId: string, tagId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent dropdown closing and row click
    if (!user?.id) return;

    const emailToUpdate = emailCache.get(emailId);
     if (!emailToUpdate) {
         console.warn(`Email ${emailId} not found in cache for tagging.`);
         toast({ title: "Error", description: "Could not find email data to update tags.", variant: "destructive" });
         return;
     }


    const isCurrentlyTagged = emailToUpdate.tags.some(t => t.id === tagId);
    const tagDetails = availableTags.find(t => t.id === tagId);
    if (!tagDetails) return; 

    // Optimistic UI update
    const updatedTags = isCurrentlyTagged
      ? emailToUpdate.tags.filter(t => t.id !== tagId)
      : [...emailToUpdate.tags, tagDetails];

    setEmailCache((prevCache) => {
      const newCache = new Map(prevCache);
      const currentEmail = newCache.get(emailId);
      if (currentEmail) {
        newCache.set(emailId, { ...currentEmail, tags: updatedTags });
      }
      return newCache;
    });
     // Update allEmails state as well
     setAllEmails((prevEmails) =>
       prevEmails.map((e) => (e.id === emailId ? { ...e, tags: updatedTags } : e))
     );


    try {
      if (isCurrentlyTagged) {
        await removeTagFromEmail(user.id, emailId, tagId);
        toast({ title: "Tag removed" });
      } else {
        await addTagToEmail(user.id, emailId, tagId);
        toast({ title: "Tag added" });
      }
    } catch (err) {
      console.error("Failed to update tags:", err);
      toast({ title: "Error updating tags", description: (err as Error).message, variant: "destructive" });
      
       const revertedTags = isCurrentlyTagged
         ? [...emailToUpdate.tags, tagDetails] 
         : emailToUpdate.tags.filter(t => t.id !== tagId); 
       setEmailCache((prevCache) => {
         const newCache = new Map(prevCache);
         const currentEmail = newCache.get(emailId);
         if (currentEmail) {
           newCache.set(emailId, { ...currentEmail, tags: revertedTags });
         }
         return newCache;
       });
        setAllEmails((prevEmails) =>
          prevEmails.map((e) => (e.id === emailId ? { ...e, tags: revertedTags } : e)) 
        );
    }
  };


  const goToNextPage = () => {
    if (nextPageToken) {
      setPrevPageTokens([...prevPageTokens, pageToken || '']); 
      setPageToken(nextPageToken);
    }
  };

  const goToPrevPage = () => {
    if (prevPageTokens.length > 0) {
      const lastToken = prevPageTokens[prevPageTokens.length - 1];
      setPrevPageTokens(prevPageTokens.slice(0, -1));
      setPageToken(lastToken);
    }
  };

  const triggerRefresh = useCallback(() => {
    if (!isTagView && !isSearchView && !isNewTagFilterView && !isLoading) {
      setEmailCache(new Map());
      setPageToken(null);
      setError(null);
      setRefreshKey(prevKey => prevKey + 1);
    }
  }, [isTagView, isSearchView, isNewTagFilterView, isLoading]);

  useEffect(() => {
    const handleRefresh = () => {
      triggerRefresh();
    };
    window.addEventListener('refreshEmails', handleRefresh);
    return () => {
      window.removeEventListener('refreshEmails', handleRefresh);
    };
  }, [triggerRefresh]);

  // --- Render Logic ---
  return (
    <div className="flex flex-col h-full">
      <EmailListToolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectAll={selectAll}
        onSelectAll={handleSelectAll}
        isLoading={isLoading}
        hasEmails={filteredEmails.length > 0}
      />

      {isLoading && (
        <div className="flex-grow flex justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && error && (
        <div className="flex-grow flex justify-center items-center text-red-600">
          Error: {error}
        </div>
      )}

      {!isLoading && !error && filteredEmails.length === 0 && (
        <div className="flex-grow flex justify-center items-center text-muted-foreground">
          No emails found.
        </div>
      )}

      {!isLoading && !error && filteredEmails.length > 0 && (
        <div className="flex-grow overflow-y-auto border-t">
          {filteredEmails.map((email, index) => (
            <div key={email.id}>
              <EmailListItem
                email={email}
                selectedEmails={selectedEmails}
                availableTags={availableTags}
                userEmail={user?.email}
                onToggleStar={toggleStar}
                onToggleSelection={toggleEmailSelection}
                onTagToggle={handleTagToggle}
                navigate={navigate}
              />
              {index < filteredEmails.length - 1 && <hr className="border-gray-100" />}
            </div>
          ))}
        </div>
      )}

      {/* Hide pagination controls for any filtered view (old tag, search, or new tag filter) */}
      {!isTagView && !isSearchView && !isNewTagFilterView && (
        <PaginationControls
          hasPrevPage={prevPageTokens.length > 0}
          hasNextPage={!!nextPageToken}
          isLoading={isLoading}
          onPrevPage={goToPrevPage}
          onNextPage={goToNextPage}
        />
      )}
    </div>
  );
};

export default EmailsList;
