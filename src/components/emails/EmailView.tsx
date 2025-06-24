import DOMPurify from 'dompurify';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Tag, Send, Paperclip, ChevronDown, ChevronUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  fetchEmailThread,
  sendReply,
  getHeaderValue,
  decodeBase64Body,
  findBestBodyPart,
  fetchTags,
  fetchEmailTagIds, 
  addTagToEmail,
  removeTagFromEmail,
  markMessageAsRead,
  GmailThread,
  GmailThreadMessage,
} from '@/lib/supabaseClient';
import { Checkbox } from "@/components/ui/checkbox"

const EmailView = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const { user } = useAuth();
  const [threadData, setThreadData] = useState<GmailThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; type: string; color: string }[]>([]);
  const [emailTagIds, setEmailTagIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      if (!threadId || !user?.id) {
        setError(threadId ? 'User not authenticated.' : 'No thread ID provided.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const fetchedThread = await fetchEmailThread(threadId);
        if (!fetchedThread || fetchedThread.messages.length === 0) {
          setError('Thread not found or empty.');
          return;
        }
        setThreadData(fetchedThread);
        setExpandedMessages(new Set([fetchedThread.messages[fetchedThread.messages.length - 1].id]));

        // Fetch tags
        const fetchedTags = await fetchTags(user.id, 'pin');
        const fetchedPriorityTags = await fetchTags(user.id, 'priority');
        setAvailableTags([...fetchedTags, ...fetchedPriorityTags]);

        // Fetch email tag IDs
        const firstMessageId = fetchedThread.messages[0].id;
        const tagIds = await fetchEmailTagIds(user.id, firstMessageId);
        setEmailTagIds(tagIds);

        // --- Mark the latest message as read ---
        const latestMessage = fetchedThread.messages[fetchedThread.messages.length - 1];
        if (latestMessage) {
          // Call the function - fire and forget for now, log errors if needed
          markMessageAsRead(latestMessage.id).then(success => {
            if (!success) {
              console.warn(`Failed to mark message ${latestMessage.id} as read via API.`);
            }
          });
        }

      } catch (err: any) {
        console.error("Error loading thread:", err);
        setError(err.message || 'Failed to load email thread.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [threadId, user?.id]);

  const handleTagToggle = async (tagId: string) => {
    if (!threadData || !user?.id || threadData.messages.length === 0) return;

    const firstMessageId = threadData.messages[0].id;
    const isCurrentlyTagged = emailTagIds.includes(tagId);

    try {
      if (isCurrentlyTagged) {
        await removeTagFromEmail(user.id, firstMessageId, tagId);
        toast({ title: "Tag removed" });
      } else {
        await addTagToEmail(user.id, firstMessageId, tagId);
        toast({ title: "Tag added" });
      }

      // Update local state
      const updatedTagIds = isCurrentlyTagged
        ? emailTagIds.filter(id => id !== tagId)
        : [...emailTagIds, tagId];
      setEmailTagIds(updatedTagIds);

    } catch (err: any) {
      console.error("Failed to update tags:", err);
      toast({ title: "Error updating tags", description: err.message, variant: "destructive" });
    }
  };

  const handleSendReply = async () => {
    if (!threadData || !replyBody.trim() || !user?.id || threadData.messages.length === 0) return;

    setIsReplying(true);
    const originalReplyBody = replyBody;
    const lastMessage = threadData.messages[threadData.messages.length - 1];

    setReplyBody('');

    try {
      const sentMessage = await sendReply(threadId, originalReplyBody, lastMessage);

      if (sentMessage) {
         setThreadData(prevThread => {
           if (!prevThread) return null;
           const messageToAdd = { ...sentMessage, payload: sentMessage.payload || lastMessage.payload };
           return { ...prevThread, messages: [...prevThread.messages, messageToAdd] };
         });
         setExpandedMessages(prev => new Set(prev).add(sentMessage.id));
         toast({ title: "Reply sent" });
      } else {
          throw new Error("API did not return sent message details.");
      }

    } catch (err: any) {
      console.error("Failed to send reply:", err);
      setReplyBody(originalReplyBody);
      toast({ title: "Error sending reply", description: err.message, variant: "destructive" });
    } finally {
        setIsReplying(false);
    }
  };

  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const createSanitizedMarkup = (htmlString: string | undefined) => {
    if (!htmlString) return { __html: '' };

    let sanitizedHtml = DOMPurify.sanitize(htmlString, {
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'style'],
    });

    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHtml, 'text/html');

    const elements = doc.body.querySelectorAll('*');
    elements.forEach((el) => {
      const style = el.getAttribute('style');
      if (style) {
        let cleanedStyle = style;

        // Remove various black color formats (black, #000, #000000, rgb(0,0,0), rgba(0,0,0,1))
        cleanedStyle = cleanedStyle.replace(/color\s*:\s*(black|#000000|#000|rgb\(0\s*,\s*0\s*,\s*0\s*\)|rgba\(0\s*,\s*0\s*,\s*0\s*,\s*1\s*\))\s*;?/gi, '');

        // Remove background and background-color
        cleanedStyle = cleanedStyle.replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '');

        // Optionally, remove font-family or size that break consistency
        // cleanedStyle = cleanedStyle.replace(/font-family\s*:\s*[^;]+;?/gi, '');

        // If cleanedStyle is empty after cleaning, remove style attribute
        if (cleanedStyle.trim() === '') {
          el.removeAttribute('style');
        } else {
          el.setAttribute('style', cleanedStyle);
        }
      }
    });

    return { __html: doc.body.innerHTML };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  if (!threadData) {
    return <div className="p-8 text-center text-muted-foreground">Email thread not found.</div>;
  }

  return (
    <div className="p-4 md:p-6 flex flex-col">
      {/* Header: Subject & Tags */}
      <div className="flex justify-between items-start mb-4 pb-4 border-b">
        <h1 className="text-xl md:text-2xl font-bold mr-4">{threadData.messages[0] ? getHeaderValue(threadData.messages[0].payload.headers, 'Subject') : 'No Subject'}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Tag className="mr-2 h-4 w-4" /> Tags ({emailTagIds.length})
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
            {availableTags.length === 0 ? (
              <DropdownMenuItem disabled>No tags available</DropdownMenuItem>
            ) : (
              availableTags.map(tag => (
                <DropdownMenuItem key={tag.id} className="flex justify-between" onSelect={(e) => e.preventDefault()}> {/* Prevent closing on select */}
                  <label htmlFor={`tag-${tag.id}`} className="flex items-center justify-between w-full p-0 cursor-pointer"> {/* Added cursor-pointer */}
                    <span className="flex items-center">
                      <span
                        className="inline-block w-3 h-3 mr-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      ></span>
                      {tag.name} ({tag.type})
                    </span>
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={emailTagIds.includes(tag.id)}
                      onCheckedChange={() => handleTagToggle(tag.id)}
                      className="ml-2"
                      aria-label={`Tag email with ${tag.name}`}
                      />
                  </label>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages List (Scrollable) */}
      <div className="flex-grow overflow-y-auto mb-4 -mr-2 pr-2 bg-background">
        {threadData.messages.map((message, index) => {
          const headers = message.payload.headers;
          const fromInfo = getHeaderValue(headers, 'From');
          const toInfo = getHeaderValue(headers, 'To');
          const ccInfo = getHeaderValue(headers, 'Cc');
          const dateStr = getHeaderValue(headers, 'Date');
          const dateObj = dateStr ? new Date(dateStr) : new Date(parseInt(message.internalDate || '0'));

          const bodyPart = findBestBodyPart(message.payload);
          const bodyContent = bodyPart ? decodeBase64Body(bodyPart.body.data) : '';
          console.log("Email body content:", bodyContent); // Add this line to inspect content

          const attachments = message.payload.parts?.filter(part => part.filename && part.body.attachmentId) ?? [];

          const isExpanded = expandedMessages.has(message.id);

          return (
            <div key={message.id} className="border rounded-md mb-3 shadow-sm overflow-hidden bg-card">
              {/* Message Header - Clickable to expand/collapse */}
              <div
                className="flex justify-between items-center p-3 bg-muted/50 cursor-pointer hover:bg-muted border-b"
                onClick={() => toggleMessageExpansion(message.id)}
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                   <div className="flex-grow overflow-hidden min-w-0">
                     <div className="text-sm font-medium text-foreground truncate">{fromInfo}</div>
                   </div>
                </div>
                <div className="flex items-center flex-shrink-0 pl-2">
                   {attachments.length > 0 && (
                     <TooltipProvider delayDuration={100}>
                       <Tooltip>
                         <TooltipTrigger asChild>
                           <Paperclip className="h-4 w-4 text-muted-foreground mr-2" />
                         </TooltipTrigger>
                         <TooltipContent>
                           {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                   )}
                   <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap">{dateObj.toLocaleString()}</span>
                   {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {/* Message Body & Attachments (Conditional Render) */}
              {isExpanded && (
                <div className="p-4 border-t dark:text-foreground"> {/* Added dark:text-foreground here */}
                   <div className="text-xs text-muted-foreground mb-3">
                     <div><span className="font-medium text-foreground">From:</span> {fromInfo}</div>
                     <div><span className="font-medium text-foreground">To:</span> {toInfo}</div>
                     {ccInfo && <div><span className="font-medium text-foreground">Cc:</span> {ccInfo}</div>}
                     <div><span className="font-medium text-foreground">Date:</span> {dateObj.toLocaleString()}</div>
                   </div>
                  <div className="max-w-none email-body-content"> {/* Added wrapper div */}
                    <div
                      dangerouslySetInnerHTML={createSanitizedMarkup(bodyContent)}
                    />
                  </div> {/* Closed wrapper div */}
                  {attachments.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <span className="text-sm font-semibold text-foreground">Attachments:</span>
                      <ul className="mt-1 space-y-1">
                        {attachments.map(att => (
                          <li key={att.partId} className="text-sm">
                            <Button variant="link" size="sm" className="p-0 h-auto">
                              <Paperclip className="h-3 w-3 mr-1" />
                              {att.filename} ({(att.body.size / 1024).toFixed(1)} KB)
                              {/* TODO: Add actual download link/handler using attachmentId */}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Reply Box */}
      <div className="flex-shrink-0 border-t pt-4">
        <Textarea
          placeholder="Write your reply..."
          value={replyBody}
          onChange={(e) => setReplyBody(e.target.value)}
          rows={4}
          className="mb-2"
          disabled={isReplying}
        />
        <div className="flex justify-end">
          <Button onClick={handleSendReply} disabled={!replyBody.trim() || isReplying}>
             {isReplying ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             ) : (
                 <Send className="mr-2 h-4 w-4" />
             )}
              Send Reply
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EmailView;