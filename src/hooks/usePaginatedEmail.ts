import { useEffect, useRef } from "react";

export const usePaginatedEmails = ({
  isAuthenticated,
  userId,
  pageToken,
  loadEmails,
  resetEmails,
}: {
  isAuthenticated: boolean;
  userId: string | null;
  pageToken: string | undefined;
  loadEmails: (token: string | null) => void;
  resetEmails: () => void;
}) => {
  const hasFetchedInitial = useRef(false);
  const lastFetchedPageToken = useRef<string | null>(null);
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      resetEmails();
      hasFetchedInitial.current = false;
      lastFetchedPageToken.current = null;
      prevUserId.current = null;
      return;
    }

    if (userId && prevUserId.current !== userId) {
      resetEmails();
      hasFetchedInitial.current = false;
      lastFetchedPageToken.current = null;
      prevUserId.current = userId;
      return;
    }

    if (!hasFetchedInitial.current && pageToken === undefined) {
      loadEmails(null);
      hasFetchedInitial.current = true;
      lastFetchedPageToken.current = null;
      return;
    }

    if (
      pageToken !== undefined &&
      pageToken !== lastFetchedPageToken.current
    ) {
      loadEmails(pageToken);
      lastFetchedPageToken.current = pageToken;
    }
  }, [isAuthenticated, userId, pageToken, loadEmails, resetEmails]);
};
