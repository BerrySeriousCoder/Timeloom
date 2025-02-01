
import React, { useState, useEffect, useCallback } from 'react';
import { MoreHorizontal, Loader2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/components/providers/AuthProvider'; 
import { useNavigate } from 'react-router-dom'; 
import {
  fetchEmailIdsTaggedToday,
  fetchFullEmailDetails,
  fetchSupabaseEmailData,
  getHeaderValue,
  GmailFullMessage,
  SupabaseEmailData,
} from '@/lib/supabaseClient'
import { Badge } from '@/components/ui/badge'; 

interface DashboardEmailItem {
  id: string; 
  threadId: string;
  subject: string;
  sender: string;
  excerpt: string;
  date: string; 
  dateObj: Date;
  tags: { id: string; name: string; color: string; type: string }[]; 
}

// Simplified Helper functions (similar to EmailsList)
const parseSender = (fromHeader: string): { name: string, address: string } => {
    if (!fromHeader) return { name: 'Unknown Sender', address: '' };
    const match = fromHeader.match(/(.*)<(.*)>/);
    if (match && match[1] && match[2]) {
        return { name: match[1].trim().replace(/"/g, ''), address: match[2].trim() };
    }
    if (fromHeader.includes('@')) return { name: fromHeader, address: fromHeader };
    return { name: fromHeader.trim().replace(/"/g, ''), address: '' };
};

const parseDate = (dateHeader: string): Date => {
    try { return new Date(dateHeader); } catch (e) { return new Date(0); }
};

const formatDate = (date: Date): string => {
    if (date.getTime() === 0) return '';
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};





const ImportantEmailsCard = () => {
  const { isAuthenticated, user, gmailConnected } = useAuth(); // Check gmail connection
  const navigate = useNavigate();
  const [emails, setEmails] = useState<DashboardEmailItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFetchedEmails = useCallback((
    messageIds: string[],
    fetchedGmailMessages: GmailFullMessage[],
    supabaseData: SupabaseEmailData[]
  ): DashboardEmailItem[] => {
    const supabaseMap = new Map<string, SupabaseEmailData>(supabaseData.map(d => [d.email_id, d]));
    const processed: DashboardEmailItem[] = [];

    fetchedGmailMessages.forEach(msg => {
      if (!msg) return;
      const supabaseDetail = supabaseMap.get(msg.id);
      const senderInfo = parseSender(getHeaderValue(msg.payload?.headers || [], 'From'));
      const dateObj = parseDate(getHeaderValue(msg.payload?.headers || [], 'Date'));

      processed.push({
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeaderValue(msg.payload?.headers || [], 'Subject') || '(No Subject)',
        sender: senderInfo.name,
        excerpt: msg.snippet || '',
        date: formatDate(dateObj),
        dateObj: dateObj,
        tags: supabaseDetail?.tags ?? [], 
      });
    });

    processed.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

    return processed;
  }, []);


  useEffect(() => {
    const loadTaggedEmails = async () => {
      if (!isAuthenticated || !user?.id || !gmailConnected) {
        setEmails([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const emailIds = await fetchEmailIdsTaggedToday(user.id);
        if (emailIds.length === 0) {
          setEmails([]);
          setIsLoading(false); 
          return;
        }

        // Fetch details for these emails
        const [gmailDetails, supabaseDetails] = await Promise.all([
          fetchFullEmailDetails(emailIds),
          fetchSupabaseEmailData(user.id, emailIds)
        ]);

        const processedEmails = processFetchedEmails(emailIds, gmailDetails, supabaseDetails);
        setEmails(processedEmails);

      } catch (err: any) {
        console.error("Error fetching emails tagged today:", err);
        setError(err.message || "Failed to load tagged emails.");
        setEmails([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTaggedEmails();
  }, [isAuthenticated, user?.id, gmailConnected, processFetchedEmails]); 

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium font-dmSans">Emails Tagged Today</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && error && (
          <div className="text-center text-red-600 py-4">{error}</div>
        )}
         {!isLoading && !error && !gmailConnected && isAuthenticated && (
           <div className="text-center text-muted-foreground py-4">
             Connect Gmail to see tagged emails.
           </div>
        )}
        {!isLoading && !error && gmailConnected && emails.length === 0 && (
          <div className="text-center text-muted-foreground py-4">No emails tagged today.</div>
        )}
        {!isLoading && !error && gmailConnected && emails.length > 0 && (
          <div className="space-y-4">
            {emails.map((email) => (
              <div
                key={email.id}
                className="space-y-1 cursor-pointer hover:bg-muted p-2 rounded-md"
                onClick={() => navigate(`/emails/thread/${email.threadId}`)} 
              >
                <div className="font-medium truncate">{email.subject}</div>
                <div className="text-sm text-muted-foreground truncate">{email.excerpt}</div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span>From: {email.sender}</span>
                  {email.date && <span className="mx-1">•</span>}
                  {email.date && <span>{email.date}</span>}
                </div>
                {/* Render Tags */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {email.tags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="secondary"
                      className="text-xs  px-1.5 py-0.5"
                      style={{ backgroundColor: tag.color, color: 'black' }}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ImportantEmailsCard;
