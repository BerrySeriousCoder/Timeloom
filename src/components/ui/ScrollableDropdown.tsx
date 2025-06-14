import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils'; // Assuming cn utility is available

interface ScrollableDropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  align?: 'start' | 'center' | 'end';
}

const ScrollableDropdown = ({ trigger, children, contentClassName, align = 'start' }: ScrollableDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const handleTriggerClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={handleTriggerClick}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            contentClassName,
            align === 'start' && 'left-0',
            align === 'center' && 'left-1/2 -translate-x-1/2',
            align === 'end' && 'right-0'
          )}
        >
          <ScrollArea className="h-[200px]"> {/* Fixed height scrollable area */}
            {children}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};

export default ScrollableDropdown;