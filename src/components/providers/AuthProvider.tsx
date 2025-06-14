
import  { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Session, User as SupabaseUser } from '@supabase/supabase-js'; 
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  gmailConnected: boolean;
  calendarConnected: boolean;
  connectGmail: () => Promise<void>;
  connectCalendar: () => Promise<void>;
  signIn: () => Promise<void>; 
  signOut: () => Promise<void>;
}

interface User {
  id: string;
  name: string;
  email: string;
  image?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [gmailConnected, setGmailConnected] = useState<boolean>(false);
  const [calendarConnected, setCalendarConnected] = useState<boolean>(false);

  useEffect(() => {
    // Set initial loading state
    setIsLoading(true);

    // Function to update state based on session
    const updateAuthState = (session: Session | null) => {
      if (session?.user) {
        const supaUser = session.user;
        setUser({
          id: supaUser.id,
          name: supaUser.user_metadata.full_name || supaUser.user_metadata.name || 'User', // Added fallback name
          email: supaUser.email || '',
          image: supaUser.user_metadata.picture || '',
        });
        setIsAuthenticated(true);

        // Check for provider_token to determine connection status
        // Note: This might need adjustment based on how you handle multiple providers or refresh tokens
        if (session.provider_token) {
          setGmailConnected(true); // Assuming token implies connection
          setCalendarConnected(true); // Assuming token implies connection
        } else {
          // Re-check or rely on specific flags if provider_token isn't always present/reliable after refresh
          setGmailConnected(false); // Defaulting to false if no token
          setCalendarConnected(false);
        }
      } else {
        // No session or user logged out
        setIsAuthenticated(false);
        setUser(null);
        setGmailConnected(false);
        setCalendarConnected(false);
      }
      // Set loading to false only after the initial check (or first event)
       setIsLoading(false);
    };

    // Get initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session);
       // Now set up the listener for real-time changes AFTER initial check
       const { data: { subscription } } = supabase.auth.onAuthStateChange(
         (_event, session) => {
           // Update state whenever auth state changes
           updateAuthState(session);
         }
       );

       // Cleanup function to unsubscribe
       return () => {
         subscription?.unsubscribe();
       };
    });

    // The effect hook itself doesn't return the cleanup directly here,
    // because the subscription is set up inside the async .then()
    // Instead, the cleanup is returned from the .then() callback.
    // This structure ensures we check the initial session first, then listen.

  }, []); // Empty dependency array ensures this runs only once on mount
  

  const signIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar',
        redirectTo: window.location.origin + '/auth/callback', 
      },
    });
    setIsLoading(false);
    if (error) {
      console.error('Google sign in failed:', error.message);
      throw error; // Re-throw to be caught by the component
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Sign out failed:', error.message);
    } else {
      setUser(null);
      setIsAuthenticated(false);
      setGmailConnected(false);
      setCalendarConnected(false);
    }
  };

  const connectGmail = async () => {
    setIsLoading(true);
    setIsLoading(false);
  };

  const connectCalendar = async () => {
    setIsLoading(true);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        gmailConnected,
        calendarConnected,
        connectGmail,
        connectCalendar,
        signIn, 
        signOut
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
