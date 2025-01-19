export interface EmailItem {
    id: string;
    threadId: string;
    subject: string;
    sender: string;
    senderAddress: string;
    excerpt: string;
    date: string;
    dateObj: Date;
    read: boolean;
    starred: boolean;
    tags: { id: string; name: string; color: string; type: string }[];
  }


export interface GmailFullMessage {
    id: string;
    threadId: string;
    labelIds?: string[];
    snippet?: string;
    payload?: {
      headers?: { name: string; value: string }[];
    };
  }
  
  export interface SupabaseEmailData {
    email_id: string;
    is_starred?: boolean;
    tags?: { id: string; name: string; color: string; type: string }[];
  }  
  
  export const parseSender = (fromHeader: string): { name: string, address: string } => {
      if (!fromHeader) return { name: 'Unknown Sender', address: '' };
      const match = fromHeader.match(/(.*)<(.*)>/);
      if (match && match[1] && match[2]) {
          return { name: match[1].trim().replace(/"/g, ''), address: match[2].trim() };
      }
      if (fromHeader.includes('@')) {
          return { name: fromHeader, address: fromHeader };
      }
      return { name: fromHeader.trim().replace(/"/g, ''), address: '' };
  };
  
  export const parseDate = (dateHeader: string): Date => {
      try {
          return new Date(dateHeader);
      } catch (e) {
          console.warn(`Could not parse date: ${dateHeader}`);
          return new Date(0);
      }
  };
  
  export const formatDate = (date: Date): string => {
      if (date.getTime() === 0) return 'Invalid Date';
      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
  
      if (isToday) {
          return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      } else {
          return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
  };
  
  export const getHeader = (headers: { name: string; value: string }[], name: string): string => {
      const header = headers?.find((h) => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
  };