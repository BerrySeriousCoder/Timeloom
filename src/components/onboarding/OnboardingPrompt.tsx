
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { useLocation } from 'react-router-dom';

const OnboardingPrompt = () => {
  const { isAuthenticated, gmailConnected, calendarConnected, signIn, connectGmail, connectCalendar } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // If authentication is complete, don't show anything
  if (isAuthenticated && 
      (currentPath !== '/emails' || gmailConnected) && 
      (currentPath !== '/calendar' || calendarConnected)) {
    return null;
  }
  
  const handleSignIn = async () => {
    try {
      await signIn();
      toast({
        title: "Sign in successful",
        description: "You've successfully signed in to your account",
      });
    } catch (error) {
      toast({
        title: "Error signing in",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };
  
  const handleConnectGmail = async () => {
    try {
      await connectGmail();
      toast({
        title: "Gmail Connected",
        description: "Your Gmail account has been successfully connected",
      });
    } catch (error) {
      toast({
        title: "Error connecting Gmail",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };
  
  const handleConnectCalendar = async () => {
    try {
      await connectCalendar();
      toast({
        title: "Calendar Connected",
        description: "Your Google Calendar has been successfully connected",
      });
    } catch (error) {
      toast({
        title: "Error connecting Calendar",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Alert className="mb-6 bg-amber-50 border-amber-200">
      <AlertCircle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-800">Set up your account</AlertTitle>
      <AlertDescription className="text-amber-700">
        <div className="mt-2 space-y-4">
          {isAuthenticated && !gmailConnected && currentPath === '/emails' && (
            <div>
              <p className="mb-2">Connect your Gmail account to view and manage your emails.</p>
              <Button
                onClick={handleConnectGmail}
                className="bg-purple hover:bg-purple/90"
              >
                Connect Gmail
              </Button>
            </div>
          )}
          
          {isAuthenticated && !calendarConnected && currentPath === '/calendar' && (
            <div>
              <p className="mb-2">Connect your Google Calendar to view and manage your events.</p>
              <Button 
                onClick={handleConnectCalendar}
                className="bg-purple hover:bg-purple/90"
              >
                Connect Google Calendar
              </Button>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default OnboardingPrompt;
