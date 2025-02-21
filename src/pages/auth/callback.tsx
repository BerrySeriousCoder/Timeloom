import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Error getting session:', error);
      }

      if (session) {
        // Redirect to the main page after successful authentication
        navigate('/');
        window.location.reload(); // Force a full page reload
      } else {
        // Handle the case where there is no session
        console.log('No session found.');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div>
      <p>Authenticating...</p>
    </div>
  );
};

export default AuthCallback;