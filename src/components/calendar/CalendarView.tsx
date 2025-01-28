
import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Define Tag type locally (matching other files)
interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

// Define Event type locally (simplified, assuming fetched data structure)
interface CalendarEvent {
    id: string;
    title: string;
    date: Date; // Assuming date object for simplicity here
    type: string; // Existing property
    tags?: Tag[]; // Add tags property
}

// Example hardcoded events with tags for demonstration
const events: CalendarEvent[] = [
    { id: '1', title: 'Team Meeting', date: new Date(), type: 'meeting', tags: [{ id: 't1', name: 'Urgent', type: 'priority', color: '#ef4444' }] },
    { id: '2', title: 'Project Alpha Review', date: new Date(), type: 'project', tags: [{ id: 't2', name: 'Client', type: 'pin', color: '#3b82f6' }, { id: 't3', name: 'Review', type: 'pin', color: '#a855f7' }] },
    { id: '3', title: 'Design Sync', date: new Date(), type: 'meeting', tags: [] }, // Event with no tags
];

const CalendarView = () => {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  
  // Get events for the selected date
  const selectedDateEvents = events.filter(
    (event: CalendarEvent) => date && // Add type annotation
    event.date.getDate() === date.getDate() &&
    event.date.getMonth() === date.getMonth() &&
    event.date.getFullYear() === date.getFullYear()
  );
  
  // Function to highlight dates with events
  const isDayWithEvent = (day: Date) => {
    return events.some(
      (event: CalendarEvent) => // Add type annotation
        event.date.getDate() === day.getDate() &&
        event.date.getMonth() === day.getMonth() &&
        event.date.getFullYear() === day.getFullYear()
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card className="border shadow-sm">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
              modifiers={{
                event: isDayWithEvent,
              }}
              modifiersStyles={{
                event: {
                  fontWeight: 'bold',
                  backgroundColor: 'rgba(155, 48, 255, 0.1)',
                  color: '#9b30ff',
                },
              }}
            />
          </CardContent>
        </Card>
      </div>
      
      <div>
        <Card className="border shadow-sm h-full">
          <CardContent className="p-4">
            <h3 className="font-medium text-lg mb-4">
              {date ? date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : 'Select a date'}
            </h3>
            
            {selectedDateEvents.length > 0 ? (
              <div className="space-y-4">
                {selectedDateEvents.map((event, index) => (
                  <div key={index} className="p-3 border rounded-md">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium">{event.title}</h4>
                      <Badge variant="outline" className={
                        event.type === 'travel' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        event.type === 'accommodation' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-purple-50 text-purple-700 border-purple-200'
                      }>
                        {event.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                    {/* Render Tags */}
                    {event.tags && event.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {event.tags.map((tag) => (
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
            ) : (
              <p className="text-muted-foreground">No events scheduled</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarView;
