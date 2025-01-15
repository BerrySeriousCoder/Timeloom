
import { supabase } from '@/lib/supabaseClient';
import { LogIn } from 'lucide-react'; 

const GoogleAuth = () => {


  const handleSignInClick = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.labels',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
        ].join(' '), 
      },
    });
  
    if (error) {
      console.error('Error signing in with Google:', error);
    } else {
      console.log('Sign in with Google initiated:', data);
    }
  };
  

  return (
    
    <div className="flex justify-center items-center h-full">
      <button
        onClick={handleSignInClick}
        className="bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-lg py-3 px-5 font-medium transition-colors duration-200 flex items-center justify-center"
      >
        <LogIn className="w-4 h-4 mr-2" /> 
        Sign in / Sign up with Google
      </button>
    </div>
  );
};

export default GoogleAuth;