import type React from "react"
import { useTheme } from 'next-themes';
import { useState, useMemo } from "react"
import {
    addDays,
    format,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    startOfMonth,
    endOfMonth,
    startOfYear,
    endOfYear,
    eachMonthOfInterval,
    isWithinInterval,
    parseISO,
    isSameDay,
    isSameMonth,
} from "date-fns"
import {  ChevronLeft, ChevronRight, Calendar, Maximize, Minimize } from "lucide-react" // Added Maximize, Minimize
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import type { TimelineCard } from "@/lib/timelineClient"

// Reuse the TimelineCard interface from the main component
interface TagData {
    id: string
    name: string
    type: string
    color: string
}


interface GanttChartProps {
    cards: TimelineCard[]
    isLoading: boolean
}

type ViewType = "weekly" | "monthly" | "yearly"

const GanttChart: React.FC<GanttChartProps> = ({ cards, isLoading }) => {
    const { theme: currentTheme } = useTheme();
    const darkMode = currentTheme === 'dark';
    const [view, setView] = useState<ViewType>("weekly")
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedCard, setSelectedCard] = useState<TimelineCard | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false) 

    // Calculate date range based on view
    const dateRange = useMemo(() => {
        if (view === "weekly") {
            const start = startOfWeek(currentDate, { weekStartsOn: 1 }) // Start on Monday
            const end = endOfWeek(currentDate, { weekStartsOn: 1 })
            return eachDayOfInterval({ start, end })
        } else if (view === "monthly") {
            const start = startOfMonth(currentDate)
            const end = endOfMonth(currentDate)
            return eachDayOfInterval({ start, end })
        } else {
            // Yearly view - return array of months
            const start = startOfYear(currentDate)
            const end = endOfYear(currentDate)
            return eachMonthOfInterval({ start, end })
        }
    }, [currentDate, view])

    // Filter cards based *only* on the current date range view
    const filteredCards = useMemo(() => {
        return cards.filter((card) => {
            // Internal search filter removed - filtering is done in the parent component

            // Date range filter - show cards that overlap with current view
            const startDate = parseISO(card.start_date)
            const endDate = card.end_date ? parseISO(card.end_date) : startDate

            const rangeStart = dateRange[0]
            const rangeEnd = dateRange[dateRange.length - 1]

            // For yearly view, we need to adjust the range end to end of the last month
            const adjustedRangeEnd = view === "yearly" ? endOfMonth(rangeEnd) : rangeEnd

            const overlapsRange =
                isWithinInterval(startDate, { start: rangeStart, end: adjustedRangeEnd }) ||
                isWithinInterval(endDate, { start: rangeStart, end: adjustedRangeEnd }) ||
                (startDate <= rangeStart && endDate >= adjustedRangeEnd)

            return overlapsRange // Only filter by date range now
        })
    }, [cards, dateRange, view]) // Removed searchTerm dependency

    // Navigation functions
    const goToPrevious = () => {
        if (view === "weekly") {
            setCurrentDate((prev) => addDays(prev, -7))
        } else if (view === "monthly") {
            const prevMonth = new Date(currentDate)
            prevMonth.setMonth(prevMonth.getMonth() - 1)
            setCurrentDate(prevMonth)
        } else {
            // Yearly view
            const prevYear = new Date(currentDate)
            prevYear.setFullYear(prevYear.getFullYear() - 1)
            setCurrentDate(prevYear)
        }
    }

    const goToNext = () => {
        if (view === "weekly") {
            setCurrentDate((prev) => addDays(prev, 7))
        } else if (view === "monthly") {
            const nextMonth = new Date(currentDate)
            nextMonth.setMonth(nextMonth.getMonth() + 1)
            setCurrentDate(nextMonth)
        } else {
            // Yearly view
            const nextYear = new Date(currentDate)
            nextYear.setFullYear(nextYear.getFullYear() + 1)
            setCurrentDate(nextYear)
        }
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    // Handle card click to show details
    const handleCardClick = (card: TimelineCard) => {
        setSelectedCard(card)
        setIsDialogOpen(true)
    }

    // Toggle fullscreen mode
    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen)
    }

    // Calculate position and width for a card in the Gantt chart
    const getCardStyle = (card: TimelineCard) => {
        const startDate = parseISO(card.start_date)
        const endDate = card.end_date ? parseISO(card.end_date) : startDate

        const rangeStart = dateRange[0]
        const rangeEnd = dateRange[dateRange.length - 1]

        // For yearly view, adjust the range end to end of the last month
        const adjustedRangeEnd = view === "yearly" ? endOfMonth(rangeEnd) : rangeEnd

        // Calculate start position
        let left = 0
        if (startDate < rangeStart) {
            left = 0
        } else {
            if (view === "yearly") {
                // For yearly view, calculate based on month
                const monthIndex =
                    startDate.getMonth() - rangeStart.getMonth() + (startDate.getFullYear() - rangeStart.getFullYear()) * 12
                left = monthIndex >= 0 ? (monthIndex / dateRange.length) * 100 : 0
            } else {
                // For weekly/monthly view, calculate based on day
                const dayIndex = dateRange.findIndex((date) =>
                    view === "weekly" || view === "monthly" ? isSameDay(date, startDate) : isSameMonth(date, startDate),
                )
                left = dayIndex >= 0 ? (dayIndex / dateRange.length) * 100 : 0
            }
        }

        // Calculate width
        let width = 0
        if (startDate > adjustedRangeEnd || endDate < rangeStart) {
            width = 0 // Not visible in this range
        } else {
            const visibleStartDate = startDate < rangeStart ? rangeStart : startDate
            const visibleEndDate = endDate > adjustedRangeEnd ? adjustedRangeEnd : endDate

            if (view === "yearly") {
                // For yearly view, calculate based on months
                const startMonthIndex =
                    visibleStartDate.getMonth() -
                    rangeStart.getMonth() +
                    (visibleStartDate.getFullYear() - rangeStart.getFullYear()) * 12
                const endMonthIndex =
                    visibleEndDate.getMonth() -
                    rangeStart.getMonth() +
                    (visibleEndDate.getFullYear() - rangeStart.getFullYear()) * 12

                const effectiveStartIndex = startMonthIndex >= 0 ? startMonthIndex : 0
                const effectiveEndIndex = endMonthIndex >= 0 ? endMonthIndex : dateRange.length - 1

                width = ((effectiveEndIndex - effectiveStartIndex + 1) / dateRange.length) * 100
            } else {
                // For weekly/monthly view, calculate based on days
                const startIndex = dateRange.findIndex((date) => isSameDay(date, visibleStartDate))
                const endIndex = dateRange.findIndex((date) => isSameDay(date, visibleEndDate))

                const effectiveStartIndex = startIndex >= 0 ? startIndex : 0
                const effectiveEndIndex = endIndex >= 0 ? endIndex : dateRange.length - 1

                width = ((effectiveEndIndex - effectiveStartIndex + 1) / dateRange.length) * 100
            }
        }

        // Get the primary color from the first tag or use a default
        const primaryColor = card.tags && card.tags.length > 0 ? card.tags[0].color : "#6366f1"

        return {
            left: `${left}%`,
            width: `${Math.max(width, 3)}%`, // Ensure minimum width for visibility
            backgroundColor: primaryColor,
        }
    }

    // Format date range for display
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

    return (
        <>
            <Card className={cn(
                "w-full transition-all duration-300 ease-in-out",
                isFullscreen
                    ? "fixed inset-0 z-50 bg-background flex flex-col" 
                    : "relative" // Normal styles
            )}>
                <CardHeader className={cn("pb-2", isFullscreen && "flex-shrink-0")}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <CardTitle>Project Gantt Chart</CardTitle>
                        <div className="flex items-center gap-2">
                            <Tabs defaultValue={view} value={view} onValueChange={(value) => setView(value as ViewType)}>
                                <TabsList>
                                    <TabsTrigger
                                        value="weekly"
                                        className={
                                            view === "weekly" ? "data-[state=active]:bg-purple-600 data-[state=active]:text-white" : ""
                                        }
                                    >
                                        Weekly
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="monthly"
                                        className={
                                            view === "monthly" ? "data-[state=active]:bg-purple-600 data-[state=active]:text-white" : ""
                                        }
                                    >
                                        Monthly
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="yearly"
                                        className={
                                            view === "yearly" ? "data-[state=active]:bg-purple-600 data-[state=active]:text-white" : ""
                                        }
                                    >
                                        Yearly
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <div className={cn(
                    "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 px-6", 
                    isFullscreen ? "flex-shrink-0 border-b pb-4" : "hidden" // Show only in fullscreen, add border/padding
                )}>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={goToPrevious}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" onClick={goToToday}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Today
                        </Button>
                        <Button variant="outline" size="icon" onClick={goToNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <span className="font-medium">
                            {view === "weekly"
                                ? `${format(dateRange[0], "MMM d")} - ${format(dateRange[dateRange.length - 1], "MMM d, yyyy")}`
                                : view === "monthly"
                                    ? format(currentDate, "MMMM yyyy")
                                    : format(currentDate, "yyyy")}
                        </span>
                    </div>
                </div>

                <CardContent className={cn(isFullscreen ? "flex-grow" : "")}> 
                    {/* Navigation Controls - Rendered here only when NOT fullscreen */}
                    {!isFullscreen && (
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={goToPrevious}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" onClick={goToToday}>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Today
                                </Button>
                                <Button variant="outline" size="icon" onClick={goToNext}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                                <span className="font-medium">
                                    {view === "weekly"
                                        ? `${format(dateRange[0], "MMM d")} - ${format(dateRange[dateRange.length - 1], "MMM d, yyyy")}`
                                        : view === "monthly"
                                            ? format(currentDate, "MMMM yyyy")
                                            : format(currentDate, "yyyy")}
                                </span>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className={cn("flex items-center justify-center", isFullscreen ? "flex-grow" : "h-96")}>
                            <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full"></div>
                        </div>
                    ) : filteredCards.length === 0 ? (
                        <div className={cn("flex items-center justify-center text-muted-foreground", isFullscreen ? "flex-grow" : "h-96")}>
                            No project cards found for this period
                        </div>
                    ) : (
                        <div> 
                            <div className="min-w-[768px] overflow-x-auto">
                                <div className="flex border-b">
                                    <div className="w-full flex">
                                        {dateRange.map((date) => (
                                            <div
                                                key={date.toISOString()}
                                                className={cn(
                                                    "flex-1 p-2 text-center text-xs border-r last:border-r-0",
                                                    (view === "weekly" || view === "monthly") &&
                                                        isSameDay(date, new Date()) &&
                                                        (darkMode ? "bg-gray-600 text-white" : "font-bold"),
                                                    view === "yearly" && isSameMonth(date, new Date()) && (darkMode ? "bg-gray-700 text-white" : "bg-purple-50 font-bold") // Changed bg-gray-600 to bg-gray-700 for dark mode
                                                )}
                                            >
                                                {view === "weekly" && (
                                                    <>
                                                        <div>{format(date, "EEE")}</div>
                                                        <div>{format(date, "d")}</div>
                                                    </>
                                                )}
                                                {view === "monthly" && <div>{format(date, "d")}</div>}
                                                {view === "yearly" && <div>{format(date, "MMM")}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Gantt Chart Rows */}
                                {/* Adjust height dynamically for fullscreen */}
                                <div className={cn(
                                    "relative overflow-y-auto", // Keep overflow-y for rows
                                    isFullscreen ? "" : "h-96" 
                                )}>
                                    {filteredCards.map((card) => (
                                        <div key={card.id} className="relative h-12 border-b hover:bg-gray-600">
                                            <div
                                                className="absolute h-8 top-2 rounded-md opacity-90 shadow-sm flex items-center justify-between px-3 text-white text-xs font-medium cursor-pointer hover:opacity-100 hover:shadow-md transition-all"
                                                style={getCardStyle(card)}
                                                onClick={() => handleCardClick(card)}
                                                title="Click for details"
                                            >
                                                <div className="flex-shrink min-w-0 text-[13px] truncate mr-2 text-black">{card.title}</div>
                                                {card.tags && card.tags.length > 0 && (
                                                    <div className="flex-shrink-0 flex gap-1 items-center">
                                                        {card.tags.slice(0, 3).map((tag) => (
                                                            <span
                                                                key={tag.id}
                                                                className="inline-block px-1.5  py-0.5 rounded-sm text-[13px] whitespace-nowrap text-black"
                                                                style={{ backgroundColor: "rgba(255, 255, 255, 0.3)" }}
                                                            >
                                                                {tag.name}
                                                            </span>
                                                        ))}
                                                        {card.tags.length > 3 && (
                                                            <span className="inline-block px-1 rounded-full bg-white text-[10px] text-gray-800">
                                                                +{card.tags.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Card Details Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedCard?.title}</DialogTitle>
                        <DialogDescription>
                            {formatTimelineDateRange(selectedCard?.start_date || "", selectedCard?.end_date)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedCard?.description && (
                            <div>
                                <h4 className="text-sm font-medium mb-1">Description</h4>
                                <p className="text-sm text-muted-foreground">{selectedCard.description}</p>
                            </div>
                        )}

                        {selectedCard?.tags && selectedCard.tags.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium mb-1">Tags</h4>
                                <div className="flex flex-wrap gap-1">
                                    {selectedCard.tags.map((tag) => (
                                        <Badge
                                            key={tag.id}
                                            className="text-xs px-2 py-1"
                                            style={{ backgroundColor: tag.color, color: "black" }}
                                        >
                                            {tag.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <h4 className="text-sm font-medium mb-1">Created</h4>
                            <p className="text-sm text-muted-foreground">
                                {selectedCard && formatDistanceToNow(new Date(selectedCard.created_at), { addSuffix: true })}
                            </p>
                        </div>
                    </div>
                    <DialogClose asChild>
                        <Button variant="outline" className="mt-2">
                            Close
                        </Button>
                    </DialogClose>
                </DialogContent>
            </Dialog>
        </>
    )
}

export default GanttChart
