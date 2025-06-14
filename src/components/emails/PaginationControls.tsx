import React from 'react';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  hasPrevPage: boolean;
  hasNextPage: boolean;
  isLoading: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  hasPrevPage,
  hasNextPage,
  isLoading,
  onPrevPage,
  onNextPage,
}) => {
  return (
    <div className="flex-shrink-0 flex justify-center items-center space-x-4 py-3 border-t bg-gray-50 dark:bg-gray-950">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevPage}
        disabled={!hasPrevPage || isLoading}
      >
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={!hasNextPage || isLoading}
      >
        Next
      </Button>
    </div>
  );
};