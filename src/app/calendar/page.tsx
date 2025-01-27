import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  fetchCalendarEvents,
  GoogleCalendarEvent,
} from '@/lib/googleCalendarClient';
import {
  EventInput,
  DatesSetArg,
  EventClickArg,
  DateSelectArg,
  EventContentArg,
} from '@fullcalendar/core';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import AddEditEventDialog from '@/components/calendar/AddEditEventDialog';

interface Tag {
  id: string;
  name: string;
  type: string;
  color: string;
}

const CalendarPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [calendarEvents, setCalendarEvents] = useState<EventInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  const navigate = useNavigate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventInput | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const loadEvents = useCallback(
    async (fetchInfo?: { startStr: string; endStr: string }) => {
      if (!isAuthenticated || !user?.id) return;
      setIsLoading(true);
      setError(null);
      let startStr, endStr;
      if (fetchInfo) {
        startStr = fetchInfo.startStr;
        endStr = fetchInfo.endStr;
      } else if (calendarRef.current) {
        const currentView = calendarRef.current.getApi().view;
        startStr = currentView.activeStart.toISOString();
        endStr = currentView.activeEnd.toISOString();
      } else {
        console.error('Cannot refresh events: calendar view info not available.');
        return;
      }

      try {
        const googleEvents: GoogleCalendarEvent[] = await fetchCalendarEvents(
          user.id,
          'primary',
          startStr,
          endStr
        );

        const formattedEvents: EventInput[] = googleEvents.map((gEvent) => ({
          id: gEvent.id,
          title: gEvent.summary || '(No Title)',
          start: gEvent.start?.dateTime || gEvent.start?.date,
          end: gEvent.end?.dateTime || gEvent.end?.date,
          allDay: !!gEvent.start?.date,
          extendedProps: {
            description: gEvent.description,
            googleEvent: gEvent,
            tags: gEvent.tags || [],
          },
        }));

        setCalendarEvents(formattedEvents);
      } catch (err: any) {
        console.error('Error fetching calendar events:', err);
        setError(err.message || 'Failed to load calendar events.');
        toast({
          title: 'Error Loading Events',
          description: err.message || 'Could not fetch calendar events.',
          variant: 'destructive',
        });
        if (err.message === 'Google API token expired') {
          navigate('/auth');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, user?.id, toast, navigate]
  );

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setSelectedDateRange({ start: selectInfo.start, end: selectInfo.end });
    setSelectedEvent(null);
    setDialogOpen(true);
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    setSelectedEvent(clickInfo.event);
    setSelectedDateRange(null);
    setDialogOpen(true);
  };

  const handleSaveSuccess = (savedEventData: GoogleCalendarEvent) => {
    loadEvents();
  };

  const handleDeleteSuccess = (deletedEventId: string) => {
    loadEvents();
  };

  const renderEventContent = (eventInfo: EventContentArg) => {
    const tags = (eventInfo.event.extendedProps.tags as Tag[]) || [];
    const isAllDay = eventInfo.event.allDay;
    const timeText = eventInfo.timeText;
    const viewType = eventInfo.view.type;

    const isGridView = viewType === 'timeGridWeek' || viewType === 'timeGridDay';
    let containerClasses =
      'flex flex-col overflow-hidden p-1 rounded-sm text-black dark:text-white';

    if (isGridView) {
      containerClasses += ' bg-transparent border-l-4 border-blue-500 dark:border-blue-400';
    }

    return (
      <div className={containerClasses}>
        <div className="flex items-center mb-1">
          {!isAllDay && timeText && (
            <span className="text-xs font-medium mr-1.5 whitespace-nowrap">{timeText}</span>
          )}
          {isAllDay && (
            <Badge
              variant="outline"
              className="text-xs px-1 py-0 mr-1.5 whitespace-nowrap"
            >
              All-day
            </Badge>
          )}
          <span className="font-semibold text-sm truncate font-dmSans">{eventInfo.event.title}</span>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 pt-0.5">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs px-1 py-0.5 font-normal leading-none"
                style={{ backgroundColor: tag.color, color: 'black' }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  };

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!isAuthenticated) {
    return <div className="p-6">Please log in to view your calendar.</div>;
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <h1 className="text-2xl font-bold font-bebas mb-4">Calendar</h1>

      {error && (
        <div className="p-4 mb-4 text-center text-red-600 bg-red-100 border border-red-300 rounded-md">
          Error: {error}
          <button onClick={() => setError(null)} className="ml-2 text-sm underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-grow relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" /> Loading...
          </div>
        )}
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          customButtons={{
            timezoneButton: {
              text: browserTimezone,
            },
          }}
          headerToolbar={{
            left: 'prev,next today timezoneButton',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={calendarEvents}
          editable={true}
          selectable={true}
          selectMirror={true}
          dayMaxEvents={true}
          eventOverlap={false}
          slotEventOverlap={false}
          eventDisplay="auto"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
          }}
          displayEventEnd={true}
          datesSet={(dateInfo: DatesSetArg) => {
            loadEvents({ startStr: dateInfo.startStr, endStr: dateInfo.endStr });
          }}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventContent={renderEventContent}
        />
      </div>

      <AddEditEventDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        event={selectedEvent}
        dateRange={selectedDateRange}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
};

export default CalendarPage;
