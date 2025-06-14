
import { LogIn } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider'; // Import useAuth hook

const GoogleAuth = () => {
  const { signIn } = useAuth(); // Get signIn function from AuthContext

  // Remove the redundant handleSignInClick function


  return (
    
    <div className="flex justify-center items-center h-full">
      <button
        onClick={signIn} // Use the signIn function from AuthContext
        className="bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-lg py-3 px-5 font-medium transition-colors duration-200 flex items-center justify-center"
      >
        <LogIn className="w-4 h-4 mr-2" />
        Sign in / Sign up with Google
      </button>
    </div>
  );
};

export default GoogleAuth;