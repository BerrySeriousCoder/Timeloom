import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface EmailListToolbarProps {
  activeTab: string;
  onTabChange: (value: string) => void;
  selectAll: boolean;
  onSelectAll: (checked: boolean) => void;
  isLoading: boolean;
  hasEmails: boolean;
}

export const EmailListToolbar: React.FC<EmailListToolbarProps> = ({
  activeTab,
  onTabChange,
  selectAll,
  onSelectAll,
  isLoading,
  hasEmails,
}) => {
  return (
    <div className="mb-4 bg-white sticky top-0 z-10 pb-2 border-b">
      <div className="flex items-center space-x-2 mb-4 px-4 pt-2">
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Checkbox
                checked={selectAll}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
                disabled={isLoading || !hasEmails}
                aria-label="Select all emails on current page"
              />
            </TooltipTrigger>
            <TooltipContent>Select all</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="w-full px-4"
      >
        <TabsList className="grid grid-cols-4 w-fit"> 
          <TabsTrigger value="all" disabled={isLoading}>All</TabsTrigger>
          <TabsTrigger value="unread" disabled={isLoading}>Unread</TabsTrigger>
          <TabsTrigger value="starred" disabled={isLoading}>Starred</TabsTrigger>
          <TabsTrigger value="important" disabled={isLoading}>Important</TabsTrigger> 
        </TabsList>
      </Tabs>
    </div>
  );
};