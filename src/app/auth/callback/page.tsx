import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from '@/lib/supabaseClient'; 

const AuthCallback = () => {
  const navigate = useNavigate(); 

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        // User is authenticated, redirect to the dashboard or home page
        navigate('/');
      } else {
        // Handle cases where session is not obtained (e.g., error)
        console.error('Authentication callback failed: No session found.');
        // Optionally redirect to an error page or the login page
        navigate('/auth'); 
      }
    };

    handleAuthCallback();
  }, [navigate]); // Depend on navigate

  // Optionally render a loading state or message while processing
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <p className="text-gray-800 dark:text-gray-200">Processing authentication...</p>
    </div>
  );
};

export default AuthCallback;