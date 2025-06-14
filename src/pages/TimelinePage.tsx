import { useState, useEffect, useCallback, useMemo } from "react" // Added useMemo
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { useAuth } from "@/components/providers/AuthProvider"
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { fetchRecentEmailTagActivity, type TimelineEvent, fetchTags } from "@/lib/supabaseClient" // Added fetchTags
import { fetchRecentCardActivity, type CardTag } from "@/lib/cardApi" // Added CardTag
import { fetchRecentCalendarActivity } from "@/lib/googleCalendarClient"
import { fetchTimelineCardsWithTags, type TimelineCard, deleteTimelineCard } from "@/lib/timelineClient"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Edit, Trash2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import AddEditTimelineCardDialog from "@/components/timeline/AddEditTimelineCardDialog"
import GanttChart from "@/components/timeline/GanttChart"
import ProjectSearchToolbar from "@/components/timeline/ProjectSearchToolbar" // Added Toolbar import
import type { FilterMode } from "@/lib/tagFiltering" // Added FilterMode type

// Reusable Tag interface (ensure consistency) - CardTag from cardApi might be sufficient
interface TagData { // This might be redundant if CardTag covers it
  id: string
  name: string
  type: string
  color: string
}

// Helper to format date range for display
const formatTimelineDateRange = (startDateStr: string, endDateStr?: string | null): string => {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
  try {
    const startDate = new Date(startDateStr + "T00:00:00") // Treat as local date
    if (isNaN(startDate.getTime())) return "Invalid Start Date"

    const formattedStart = startDate.toLocaleDateString(undefined, options)

    if (endDateStr) {
      const endDate = new Date(endDateStr + "T00:00:00")
      if (isNaN(endDate.getTime())) return formattedStart // Only show start if end is invalid
      const formattedEnd = endDate.toLocaleDateString(undefined, options)
      // Show range only if start and end are different days
      return startDate.toDateString() === endDate.toDateString()
        ? formattedStart
        : `${formattedStart} - ${formattedEnd}`
    }
    return formattedStart // Only start date provided
  } catch (e) {
    console.error("Error formatting date range:", e)
    return "Invalid Date"
  }
}

const TimelinePage = () => {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate(); // Get the navigate function
  const { theme: currentTheme } = useTheme();
  const darkMode = currentTheme === 'dark';
  const { toast } = useToast()

  // State for default timeline activities (still needed for data fetching)
  const [emailTagActivity, setEmailTagActivity] = useState<TimelineEvent[]>([])
  const [cardActivity, setCardActivity] = useState<TimelineEvent[]>([])
  const [calendarActivity, setCalendarActivity] = useState<TimelineEvent[]>([])

  // State for custom timeline cards
  const [customTimelineCards, setCustomTimelineCards] = useState<TimelineCard[]>([])

  // Combined loading/error state
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State for the dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [cardToEdit, setCardToEdit] = useState<TimelineCard | null>(null)

  // State for Global Search and Filtering
  const [globalSearchTerm, setGlobalSearchTerm] = useState("")
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([])
  const [tagFilterMode, setTagFilterMode] = useState<FilterMode>("any")
  const [availableTags, setAvailableTags] = useState<CardTag[]>([])
  const [isLoadingTags, setIsLoadingTags] = useState(false)

  // Define the loading function using useCallback
  const loadTimeline = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setEmailTagActivity([])
      setCardActivity([])
      setCalendarActivity([])
      setCustomTimelineCards([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch all four types of activities concurrently
      const [emailResults, cardResults, calendarResults, customCardResults] = await Promise.all([
        fetchRecentEmailTagActivity(user.id, 20),
        fetchRecentCardActivity(user.id, 20),
        fetchRecentCalendarActivity("primary", 10),
        fetchTimelineCardsWithTags(user.id),
      ])

      // Set separate states
      setEmailTagActivity(emailResults)
      setCardActivity(cardResults)
      setCalendarActivity(calendarResults)
      setCustomTimelineCards(customCardResults)
    } catch (err) {
      console.error("Failed to load timeline:", err)
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred"
      setError(`Failed to load timeline activity: ${errorMessage}`)
      // Clear state on error
      setEmailTagActivity([])
      setCardActivity([])
      setCalendarActivity([])
      setCustomTimelineCards([])

      // Check for the specific token expiration error and redirect
      if (errorMessage === 'Google API token expired') {
        navigate('/auth');
      }

    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.id, navigate]) // Add navigate to dependency array

  // useEffect hook to call the memoized loadTimeline function
  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  // Fetch available tags for filtering
  useEffect(() => {
    const loadTags = async () => {
      if (user?.id) {
        setIsLoadingTags(true)
        try {
          const pinTags = await fetchTags(user.id, "pin")
          const priorityTags = await fetchTags(user.id, "priority")
          setAvailableTags([...pinTags, ...priorityTags])
        } catch (error) {
          console.error("Failed to fetch tags for filtering:", error)
          toast({ title: "Error", description: "Could not load tags for filtering.", variant: "destructive" })
          setAvailableTags([])
        } finally {
          setIsLoadingTags(false)
        }
      } else {
        setAvailableTags([])
        setIsLoadingTags(false)
      }
    }
    loadTags()
  }, [user?.id, toast])


  // --- Filtering Logic ---
  const filteredCardsForDisplay = useMemo(() => {
    return customTimelineCards.filter((card) => {
      // Text search filter
      const searchTermLower = globalSearchTerm.toLowerCase()
      const matchesSearch =
        !globalSearchTerm ||
        card.title.toLowerCase().includes(searchTermLower) ||
        (card.description && card.description.toLowerCase().includes(searchTermLower)) ||
        card.tags.some((tag) => tag.name.toLowerCase().includes(searchTermLower))

      if (!matchesSearch) return false

      // Tag filter
      if (selectedFilterTagIds.length === 0) {
        return true // No tags selected, so pass tag filter
      }

      const cardTagIds = new Set(card.tags.map((t) => t.id))

      if (tagFilterMode === "any") {
        return selectedFilterTagIds.some((filterTagId) => cardTagIds.has(filterTagId))
      } else {
        // 'all' mode
        return selectedFilterTagIds.every((filterTagId) => cardTagIds.has(filterTagId))
      }
    })
  }, [customTimelineCards, globalSearchTerm, selectedFilterTagIds, tagFilterMode])


  // --- Handlers ---
  const handleAddClick = () => {
    setCardToEdit(null)
    setIsDialogOpen(true)
  }

  const handleEditClick = (card: TimelineCard) => {
    setCardToEdit(card)
    setIsDialogOpen(true)
  }

  const handleSaveSuccess = (savedCard: TimelineCard) => {
    setCustomTimelineCards((prevCards) => {
      const index = prevCards.findIndex((c) => c.id === savedCard.id)
      if (index !== -1) {
        // Update existing card
        const newCards = [...prevCards]
        newCards[index] = savedCard
        return newCards
      } else {
        // Add new card
        return [savedCard, ...prevCards]
      }
    })
    toast({ title: "Success", description: `Card "${savedCard.title}" saved.` })
  }

  const handleDeleteSuccess = (deletedCardId: string) => {
    setCustomTimelineCards((prevCards) => prevCards.filter((card) => card.id !== deletedCardId))
    toast({ title: "Success", description: "Card deleted." })
  }

  // Handler for direct delete button
  const handleDeleteClick = async (cardId: string) => {
    if (!user?.id) return
    try {
      await deleteTimelineCard(user.id, cardId)
      handleDeleteSuccess(cardId)
    } catch (error) {
      console.error("Failed to delete card:", error)
      toast({
        title: "Error",
        description: `Failed to delete card. ${error instanceof Error ? error.message : ""}`,
        variant: "destructive",
      })
    }
  }

  return (
    <div className="p-6 overflow-hidden"> {/* Removed w-full, kept overflow-hidden */}
      <div className="flex justify-between items-center mb-4"> {/* Reduced mb */}
        <h1 className="text-2xl font-bebas font-bold">Project</h1>
        {/* Add Button */}
        {isAuthenticated && (
          <Button onClick={handleAddClick} className="bg-purple hover:bg-purple/90">
            <Plus className="mr-2 h-4 w-4" /> Add Project Card
          </Button>
        )}
      </div>

      {/* Search and Filter Toolbar - Rendered below header, above content */}
      {isAuthenticated && (
          <ProjectSearchToolbar
              searchTerm={globalSearchTerm}
              onSearchTermChange={setGlobalSearchTerm}
              selectedTagIds={selectedFilterTagIds}
              onSelectedTagIdsChange={setSelectedFilterTagIds}
              availableTags={availableTags}
              filterMode={tagFilterMode}
              onFilterModeChange={setTagFilterMode}
              isLoadingTags={isLoadingTags}
          />
      )}

      {isLoading && (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="p-4 text-center text-red-600 bg-red-100 border border-red-300 rounded-md mb-6">
          Error: {error}
          <button onClick={loadTimeline} className="ml-2 text-sm underline">
            Retry
          </button>
        </div>
      )}

      {/* Gantt Chart Section - Replaces the three activity cards */}
      {!isLoading && !error && (
        <div className="mb-6"> {/* Removed overflow-hidden */}
          <GanttChart cards={filteredCardsForDisplay} isLoading={isLoading} />
        </div>
      )}

      Render Custom Timeline Cards Section - Kept as requested
      {!isLoading && !error && isAuthenticated && (
        <div className="mt-6 pt-6 border-t">
          <h2 className="text-xl  font-  mb-4">Custom Project Cards</h2>
          {filteredCardsForDisplay.length === 0 ? ( // Check filtered list
            <div className="text-center text-muted-foreground py-6 border rounded-md bg-muted/30">
              {customTimelineCards.length === 0
                ? 'No custom project cards created yet. Click "Add Project Card" to get started.' // Original empty state
                : 'No project cards match your current search/filter criteria.' // Empty state due to filters
              }
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-4">
            {filteredCardsForDisplay.map((card) => (
              <div key={card.id} className={cn("shadow p-4 rounded", darkMode ? "bg-gray-800" : "")}>
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-semibold text-lg">{card.title}</h2>
                    <p className={cn("text-sm", darkMode ? "text-gray-400" : "text-black")}>{formatTimelineDateRange(card.start_date, card.end_date)}</p>
                    {card.description && (
                      <p className={cn("mt-2", darkMode ? "text-gray-300" : "text-black")}>{card.description}</p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={() => handleEditClick(card)} variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => handleDeleteClick(card.id)} variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
          
                <div className="mt-2 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag.id} className="text-black" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          )}
        </div>
      )}

      {/* Render the Dialog */}
      <AddEditTimelineCardDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        cardToEdit={cardToEdit}
        onSaveSuccess={handleSaveSuccess}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  )
}

export default TimelinePage
