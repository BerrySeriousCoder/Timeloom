import React from 'react';
import { Star, ExternalLink ,Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmailItem } from '@/lib/emailHelpers';

interface EmailListItemProps {
  email: EmailItem;
  selectedEmails: string[];
  availableTags: { id: string; name: string; type: string; color: string }[];
  userEmail?: string;
  onToggleStar: (id: string, event: React.MouseEvent) => void;
  onToggleSelection: (id: string, event: React.MouseEvent) => void;
  onTagToggle: (emailId: string, tagId: string, event: React.MouseEvent) => void;
  navigate: (path: string) => void;
}

export const EmailListItem: React.FC<EmailListItemProps> = ({
  email,
  selectedEmails,
  availableTags,
  userEmail,
  onToggleStar,
  onToggleSelection,
  onTagToggle,
  navigate
}) => {
  return (
    <div
      className={`flex items-center hover:bg-muted cursor-pointer ${
        !email.read ? 'bg-blue-50 dark:bg-gray-800 font-semibold' : ''
      } ${selectedEmails.includes(email.id) ? 'bg-blue-100 dark:bg-gray-700' : ''}`}
      onClick={() => navigate(`/emails/thread/${email.threadId}`)}
    >
      <div className="p-3 flex items-center w-full">
        <div className="flex items-center space-x-3 mr-3 flex-shrink-0">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Checkbox
                  checked={selectedEmails.includes(email.id)}
                  onCheckedChange={() => {}}
                  onClick={(e) => onToggleSelection(email.id, e)}
                  aria-label={`Select email from ${email.sender}`}
                />
              </TooltipTrigger>
              <TooltipContent>Select</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={(e) => onToggleStar(email.id, e)} className="p-0 m-0 bg-transparent border-none">
                  <Star
                    className={`h-4 w-4 transition-colors ${
                      email.starred ? 'text-amber-400 fill-amber-400' : 'text-gray-400 hover:text-gray-500'
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{email.starred ? 'Unstar' : 'Star'}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex-grow min-w-0 mr-4">
          <div className="flex justify-between items-baseline">
            <span
              className={`text-sm truncate max-w-[150px] sm:max-w-[220px] md:max-w-[300px] ${
                !email.read ? 'font-bold' : ''
              }`}
            >
              {email.sender}
            </span>
          </div>
          <h3 className={`text-sm truncate ${!email.read ? '' : 'text-gray-400'}`}>{email.subject}</h3>
          <p className="text-xs text-muted-foreground truncate">{email.excerpt}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {email.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs font-bold px-1.5 py-0.5"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 ml-auto flex-shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">
            {email.date}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700">
                <Tag className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="max-h-60 overflow-y-auto">
              {availableTags.map((tag) => {
                const isChecked = email.tags.some((et) => et.id === tag.id);
                return (
                  <DropdownMenuItem key={tag.id} className="flex justify-between items-center p-0">
                    <label
                      htmlFor={`list-tag-${email.id}-${tag.id}`}
                      className="flex items-center justify-between w-full px-2 py-1.5 cursor-pointer"
                    >
                      <span className="flex items-center">
                        <span
                          className="inline-block w-3 h-3 mr-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        ></span>
                        {tag.name} ({tag.type})
                      </span>
                      <Checkbox
                        id={`list-tag-${email.id}-${tag.id}`}
                        checked={isChecked}
                        onCheckedChange={(checked) =>
                          onTagToggle(email.id, tag.id, { stopPropagation: () => {} } as React.MouseEvent)
                        }
                        className="ml-2"
                        aria-label={`Tag email with ${tag.name}`}
                      />
                    </label>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`https://mail.google.com/mail/?authuser=${userEmail || ''}#inbox/${email.threadId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                  aria-label="Open email in Gmail"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Open in Gmail</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};