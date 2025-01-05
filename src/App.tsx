
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"; 
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import TimelinePage from "./pages/TimelinePage";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider"; 
import RootLayout from "./app/layout";
import EmailsPage from "./app/emails/page";
import EmailsList from "@/components/emails/EmailsList";
import EmailView from "@/components/emails/EmailView";
import CalendarPage from "./app/calendar/page";
import AuthPage from "./app/auth/page"; 

import AuthCallback from "./app/auth/callback/page"; 

const queryClient = new QueryClient();

// ProtectedRoute component to wrap routes that require authentication
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    // Optionally render a loading spinner or null while checking auth
    return null;
  }

  if (!isAuthenticated) {
    // Redirect to the auth page, preserving the current location in state
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth Page - Redirect authenticated users away */}
            <Route
              path="/auth"
              element={<AuthRedirect />} // Use a component to handle redirect logic
            />

            {/* Supabase Auth Callback */}
            {/* Supabase Auth Callback */}
            <Route
              path="/auth/callback"
              element={<AuthCallback />}
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={<ProtectedRoute><RootLayout><Index /></RootLayout></ProtectedRoute>}
            />
            {/* Emails Section with Nested Protected Routes */}
            <Route
              path="/emails"
              element={<ProtectedRoute><RootLayout><EmailsPage /></RootLayout></ProtectedRoute>}
            >
              {/* Index route for /emails (shows the list) */}
              <Route index element={<EmailsList />} />
              {/* Route for viewing a specific thread */}
              <Route path="thread/:threadId" element={<EmailView />} />
            </Route>
            {/* Calendar Protected Route */}
            <Route
              path="/calendar"
              element={<ProtectedRoute><RootLayout><CalendarPage /></RootLayout></ProtectedRoute>}
            />
            {/* Timeline Protected Route */}
            <Route
              path="/timeline"
              element={<ProtectedRoute><RootLayout><TimelinePage /></RootLayout></ProtectedRoute>}
            />

            {/* ADD ALL OTHER CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

// Component to handle redirecting authenticated users from the auth page
// Component to handle redirecting authenticated users from the auth page
const AuthRedirect = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const from = location.state?.from?.pathname; // Get the 'from' location from state

  if (isLoading) {
    // Optionally render a loading spinner or null while checking auth
    return null;
  }

  // If authenticated AND we have a 'from' state (meaning they were redirected from a protected route),
  // redirect them back. Otherwise, render the AuthPage (either not authenticated,
  // or authenticated but arrived directly at /auth or via error redirect).
  if (isAuthenticated && from) {
    return <Navigate to={from} replace />;
  }

  // If not authenticated, or authenticated but no 'from' state, render the AuthPage
  return <AuthPage />;
};


export default App;
