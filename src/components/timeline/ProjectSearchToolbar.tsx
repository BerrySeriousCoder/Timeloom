import React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Search, Tag } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import type { CardTag } from "@/lib/cardApi"
import type { FilterMode } from "@/lib/tagFiltering" 

interface ProjectSearchToolbarProps {
    searchTerm: string
    onSearchTermChange: (term: string) => void
    selectedTagIds: string[]
    onSelectedTagIdsChange: (ids: string[]) => void
    availableTags: CardTag[]
    filterMode: FilterMode
    onFilterModeChange: (mode: FilterMode) => void
    isLoadingTags: boolean
}

const ProjectSearchToolbar: React.FC<ProjectSearchToolbarProps> = ({
    searchTerm,
    onSearchTermChange,
    selectedTagIds,
    onSelectedTagIdsChange,
    availableTags,
    filterMode,
    onFilterModeChange,
    isLoadingTags,
}) => {
    const handleTagSelectionChange = (tagId: string, checked: boolean) => {
        const newSelectedIds = checked
            ? [...selectedTagIds, tagId]
            : selectedTagIds.filter((id) => id !== tagId)
        onSelectedTagIdsChange(newSelectedIds)
    }

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-b bg-card">
            {/* Search Input */}
            <div className="relative flex-grow w-full sm:w-auto">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search projects by title, description, or tag..."
                    className="pl-8 w-full"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                />
            </div>

            {/* Tag Filter Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-auto">
                        <Tag className="mr-2 h-4 w-4" />
                        Filter Tags ({selectedTagIds.length})
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                    <DropdownMenuSeparator />
                    {isLoadingTags ? (
                        <DropdownMenuItem disabled>Loading tags...</DropdownMenuItem>
                    ) : availableTags.length === 0 ? (
                        <DropdownMenuItem disabled>No tags available</DropdownMenuItem>
                    ) : (
                        availableTags.map((tag) => (
                            <DropdownMenuCheckboxItem
                                key={tag.id}
                                checked={selectedTagIds.includes(tag.id)}
                                onCheckedChange={(checked) => handleTagSelectionChange(tag.id, !!checked)}
                                onSelect={(e) => e.preventDefault()} // Prevent closing on select
                            >
                                {tag.name} ({tag.type})
                            </DropdownMenuCheckboxItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter Mode Toggle */}
            {selectedTagIds.length > 0 && ( // Only show toggle if tags are selected
                <div className="flex items-center space-x-2">
                    <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                        Match Any
                    </Label>
                    <Switch
                        id="filter-mode-toggle"
                        checked={filterMode === "all"}
                        onCheckedChange={(checked) => onFilterModeChange(checked ? "all" : "any")}
                        aria-label="Toggle between matching any tag or all tags"
                    />
                    <Label htmlFor="filter-mode-toggle" className="text-xs text-muted-foreground">
                        Match All
                    </Label>
                </div>
            )}
        </div>
    )
}

export default ProjectSearchToolbar