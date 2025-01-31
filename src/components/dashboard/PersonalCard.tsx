
import React, { useState, useEffect } from 'react';
import { MoreHorizontal, Loader2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; // Import Badge
import { useAuth } from '@/components/providers/AuthProvider';
import { fetchTodaysCalendarEvents, GoogleCalendarEvent } from '@/lib/googleCalendarClient'; 



// Helper to format event time range
const formatEventTime = (start: GoogleCalendarEvent['start'], end: GoogleCalendarEvent['end']): string => {
  if (!start || !end) return 'Time not specified';

  if (start.date) { 
    return 'All Day';
  }

  if (start.dateTime && end.dateTime) {
    const startTime = new Date(start.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const endTime = new Date(end.dateTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  }

  return 'Invalid time format';
};


const PersonalCard = () => {
  const { isAuthenticated, calendarConnected, user } = useAuth(); // Get user object
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTodaysEvents = async () => {
      // Ensure user ID is available before fetching
      if (!isAuthenticated || !calendarConnected || !user?.id) {
        setEvents([]); // Clear events if not connected/authenticated
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        // Pass the user ID to the function
        const todaysEvents = await fetchTodaysCalendarEvents(user.id);
        setEvents(todaysEvents);
      } catch (err: any) {
        setError(err.message || "Failed to load today's events.");
        setEvents([]); // Clear events on error
      } finally {
        setIsLoading(false);
      }
    };

    loadTodaysEvents();
  }, [isAuthenticated, calendarConnected, user?.id]); 

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium font-dmSans">Today's Calendar</CardTitle>
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
        {!isLoading && !error && !calendarConnected && isAuthenticated && (
           <div className="text-center text-muted-foreground py-4">
             Connect Google Calendar to see today's events.
           </div>
        )}
        {!isLoading && !error && calendarConnected && events.length === 0 && (
          <div className="text-center text-muted-foreground py-4">No events scheduled for today.</div>
        )}
        {!isLoading && !error && calendarConnected && events.length > 0 && (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.id}> 
                 <div className="text-xs text-muted-foreground mb-1">
                   {formatEventTime(event.start, event.end)}
                 </div>
                 <div className="flex justify-between items-center"> 
                   <div className="font-medium truncate pr-2">{event.summary || '(No Title)'}</div> 
                   {event.tags && event.tags.length > 0 && (
                     <div className="flex flex-wrap gap-1 flex-shrink-0"> 
                       {event.tags.map((tag) => (
                         <Badge
                           key={tag.id}
                           variant="secondary"
                           className="text-xs px-1 py-0.5 font-normal leading-none"
                           style={{ backgroundColor: tag.color, color: 'white' }}
                         >
                           {tag.name}
                         </Badge>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PersonalCard;
