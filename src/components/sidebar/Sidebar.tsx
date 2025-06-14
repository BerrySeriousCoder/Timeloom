import  { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Mail,
  CalendarDays,
  Clock,
  Tag,
  AlertCircle,
  Plus,
  ChevronDown,
  ChevronRight, 
  Trash2,
  ChevronLeft, 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchTags,
  deleteTag,
} from '@/lib/supabaseClient';
import { ThemeToggle } from '@/components/theme-toggle';

interface TagItem {
  id: string;
  name: string;
  count: number;
  type: 'pin' | 'priority';
}

// Define props for the Sidebar component
interface SidebarProps {
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const Sidebar = ({ isCollapsed, toggleCollapse }: SidebarProps) => { 
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const { isAuthenticated, user, signOut } = useAuth(); 
  const { toast } = useToast();

  const [pinExpanded, setPinExpanded] = useState(true);
  const [priorityExpanded, setPriorityExpanded] = useState(true);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#7dd3fc'); // Default color: light blue
  const [pinSearchTerm, setPinSearchTerm] = useState('');
  const [prioritySearchTerm, setPrioritySearchTerm] = useState('');

  // Dialog states
  const [addPinDialogOpen, setAddPinDialogOpen] = useState(false);
  const [addPriorityDialogOpen, setAddPriorityDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<TagItem | null>(null);

  // Tag state (fetched from Supabase)
  const [pins, setPins] = useState<TagItem[]>([]);
  const [priorities, setPriorities] = useState<TagItem[]>([]);

  useEffect(() => {
    const loadTags = async () => {
      if (!user?.id) return;

      const fetchedPins = await fetchTags(user.id, 'pin');
      setPins(fetchedPins.map(pin => ({ ...pin, count: 0, type: 'pin' }))); // Initialize count to 0 and set type

      const fetchedPriorities = await fetchTags(user.id, 'priority');
      setPriorities(fetchedPriorities.map(priority => ({ ...priority, count: 0, type: 'priority' }))); // Initialize count to 0 and set type
    };

    if (isAuthenticated) {
      loadTags();
    }
  }, [isAuthenticated, user?.id]);

  const addNewTag = async (type: 'pin' | 'priority') => {
    // Cap the number of tags to 12
    if (type === 'pin' && pins.length >= 12) {
      toast({
        title: "Limit Reached",
        description: "You can create a maximum of 12 pin tags.",
        variant: "destructive",
      });
      return;
    }
    if (type === 'priority' && priorities.length >= 12) {
      toast({
        title: "Limit Reached",
        description: "You can create a maximum of 12 priority tags.",
        variant: "destructive",
      });
      return;
    }

    if (!newTagName.trim()) {
      toast({
        title: "Error",
        description: "Tag name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) return;

    // --- Add tag to Supabase ---
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert([{ user_id: user.id, name: newTagName, type: type, color: newTagColor }]) // Include color
        .select('id, name, type, color')
        .single();

      if (error) {
        console.error(`Error adding tag:`, error);
        toast({
          title: "Error",
          description: `Failed to create tag: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      const newTag: TagItem = {
        id: data.id,
        name: data.name,
        count: 0,
        type: data.type as 'pin' | 'priority',
      };

      // --- Update local state ---
      if (type === 'pin') {
        setPins(prev => [...prev, newTag]);
        setAddPinDialogOpen(false);
      } else {
        setPriorities(prev => [...prev, newTag]);
        setAddPriorityDialogOpen(false);
      }

      setNewTagName('');
      setNewTagColor('#7dd3fc'); // Reset color after adding tag

      toast({
        title: "Success",
        description: `New tag "${newTagName}" created`,
      });
    } catch (error: any) {
      console.error("Exception adding tag:", error);
      toast({
        title: "Error",
        description: `Failed to create tag: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  // Handler for confirming tag deletion
  const handleConfirmDelete = async () => {
    if (!tagToDelete || !user?.id) return;
    const success = await deleteTag(tagToDelete.id, user.id); 
    if (success) {
      toast({ title: "Success", description: `Tag "${tagToDelete.name}" deleted.` });
      // Remove tag from local state
      if (tagToDelete.type === 'pin') {
        setPins(prev => prev.filter(p => p.id !== tagToDelete.id));
      } else {
        setPriorities(prev => prev.filter(p => p.id !== tagToDelete.id));
      }
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    } else {
      toast({ title: "Error", description: "Failed to delete tag.", variant: "destructive" });
      // Keep dialog open or close? For now, close it.
      setDeleteDialogOpen(false);
      setTagToDelete(null);
    }
  };

  const handleTagClick = (type: string, name: string) => {
    if (pathname !== '/emails') {
      navigate(`/emails?${type}=${encodeURIComponent(name.toLowerCase())}`);
    } else {
      // Update URL search parameters using navigate
      navigate({
        pathname: '/emails',
        search: `?${type}=${encodeURIComponent(name.toLowerCase())}`
      }, { replace: true }); // Use replace to avoid history clutter
    }
  };

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/emails', label: 'Emails', icon: Mail },
    { href: '/timeline', label: 'Project', icon: Clock },
    { href: '/calendar', label: 'Calendar', icon: CalendarDays }
  ];

  return (
    <div className={cn(
      "flex-shrink-0 border-r bg-background py-4 flex flex-col h-full transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16 px-2" : "w-60 px-3" // Conditional width and padding
    )}>
      <div className={cn("flex items-center mb-8", isCollapsed ? "justify-center px-0" : "px-2")}>
        <h1 className={cn("font-bold font-dmSans text-xl text-purple-600", isCollapsed ? "hidden" : "block")}>
          <Link to="/">TIMELOOM</Link>
        </h1>
        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn("ml-auto", isCollapsed ? "ml-0" : "")} 
          onClick={toggleCollapse}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="space-y-1">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;

          return (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent",
                isActive
                  ? "bg-purple-100 text-purple-600 font-medium"
                  : "text-gray-500",
                isCollapsed ? "justify-center px-2" : "justify-start" 
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-purple-600" : "text-gray-500")} />
              {!isCollapsed && <span>{link.label}</span>} {/* Hide label when collapsed */}
            </Link>
          );
        })}
      </div>

      {!isCollapsed && ( // Hide tags section when collapsed
        <div className="mt-8 flex-1">
          <div className="mb-3">
            <div
              className="flex justify-between items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer"
              onClick={() => setPinExpanded(!pinExpanded)}
            >
              <div className="font-medium text-xs uppercase tracking-wider text-gray-500">
                PINS
              </div>
              {pinExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
            </div>

            {pinExpanded && (
              <div className="mt-2 space-y-1 ml-1 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="px-3 pb-2">
                  <Input
                    type="text"
                    placeholder="Search pins..."
                    value={pinSearchTerm}
                    onChange={(e) => setPinSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} 
                    className="h-8 text-sm"
                  />
                </div>
                {pins
                  .filter(pin => pin.name.toLowerCase().includes(pinSearchTerm.toLowerCase()))
                  .map((pin) => (
                  <div
                    key={pin.id}
                    className="group flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-accent text-gray-500" 
                  >
                    <div className="flex items-center flex-grow" onClick={() => handleTagClick('tag', pin.name)}>
                      <Tag className="h-3.5 w-3.5 mr-2 text-gray-500" />
                      <span className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap">{pin.name}</span>
                      {pin.count > 0 && (
                        <Badge variant="outline" className="text-xs ml-auto mr-2"> 
                          {pin.count}
                        </Badge>
                      )}
                    </div>
                    <div
                      className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-red-500 opacity-100 flex-shrink-0 cursor-pointer" // Replaced Button with div
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent navigation
                        setTagToDelete(pin);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start pl-3 mt-1 text-gray-500"
                  onClick={() => setAddPinDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  <span>Add Tag</span>
                </Button>
              </div>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent cursor-pointer"
              onClick={() => setPriorityExpanded(!priorityExpanded)}
            >
              <div className="font-medium text-xs uppercase tracking-wider text-gray-500">
                PRIORITY
              </div>
              {priorityExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
            </div>

            {priorityExpanded && (
              <div className="mt-2 space-y-1 ml-1 max-h-[200px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                 <div className="px-3 pb-2">
                  <Input
                    type="text"
                    placeholder="Search priorities..."
                    value={prioritySearchTerm}
                    onChange={(e) => setPrioritySearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()} // Prevent dropdown close
                    className="h-8 text-sm" 
                  />
                </div>
                {priorities
                  .filter(priority => priority.name.toLowerCase().includes(prioritySearchTerm.toLowerCase()))
                  .map((priority) => (
                  <div
                    key={priority.id}
                    className="group flex items-center justify-between px-3 py-1.5 text-sm rounded-md hover:bg-accent text-gray-500" // Removed cursor-pointer
                  >
                     <div className="flex items-center flex-grow" onClick={() => handleTagClick('priority', priority.name)}> {/* Added flex-grow and moved onClick here */}
                      <AlertCircle className="h-3.5 w-3.5 mr-2 text-gray-500" />
                      <span className="flex-grow overflow-hidden text-ellipsis whitespace-nowrap">{priority.name}</span>
                      {priority.count > 0 && (
                        <Badge variant="outline" className="text-xs ml-auto mr-2"> 
                          {priority.count}
                        </Badge>
                      )}
                    </div>
                    <div
                      className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-red-500 opacity-100 flex-shrink-0 cursor-pointer" // Replaced Button with div
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent navigation
                        setTagToDelete(priority);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </div>
                  </div>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start pl-3 mt-1 text-gray-500"
                  onClick={() => setAddPriorityDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-2" />
                  <span>Add Tag</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Dialog for adding a pin tag */}
      <Dialog open={addPinDialogOpen} onOpenChange={setAddPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Tag</DialogTitle>
            <DialogDescription>
              Create a new pin tag.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="pinTagName">Tag name</Label>
              <Input
                id="pinTagName"
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => e.key === 'Enter' && addNewTag('pin')}
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pinTagColor">Tag color</Label>
              <Input
                type="color"
                id="pinTagColor"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-10 w-full"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => addNewTag('pin')}
            >
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for adding a priority tag */}
      <Dialog open={addPriorityDialogOpen} onOpenChange={setAddPriorityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Tag</DialogTitle>
            <DialogDescription>
              Create a new priority tag.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="priorityTagName">Tag name</Label>
              <Input
                id="priorityTagName"
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="col-span-3"
                onKeyDown={(e) => e.key === 'Enter' && addNewTag('priority')}
                maxLength={20}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priorityTagColor">Tag color</Label>
              <Input
                type="color"
                id="priorityTagColor"
                value={newTagColor}
                onChange={(e) => setNewTagColor(e.target.value)}
                className="h-10 w-full"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => addNewTag('priority')}
            >
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for deleting a tag */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Tag</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag "{tagToDelete?.name}"? This will remove the tag from all associated emails. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between sm:justify-between mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTagToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive" 
              onClick={handleConfirmDelete}
            >
              Delete Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Theme Toggle Button at the bottom */}
      {!isCollapsed && (
        <div className="mt-auto px-3 py-2 flex flex-col gap-2">
          <ThemeToggle />
          {isAuthenticated && (
            <Button variant="outline" className="w-full border-red-500 justify-start text-red-500" onClick={signOut}>
              Logout
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
