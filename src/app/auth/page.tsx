import { Button } from '@/components/ui/button'; 
import { useAuth } from '@/components/providers/AuthProvider'; // Assuming AuthProvider path
import googleIcon from '../../../public/google.svg'
const AuthPage = () => {
  const { signIn, isLoading } = useAuth();

  const handleSignIn = async () => {
    try {
      await signIn();
      // Redirect or show success message handled by AuthProvider or a listener
    } catch (error) {
      console.error("Sign in failed:", error);
      // Show error message
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-500 to-blue-500">
      <div className="w-full max-w-md px-8 py-10 bg-white dark:bg-gray-800 shadow-xl rounded-lg text-gray-800 dark:text-gray-200">
        <h3 className="text-4xl font-bold text-center text-gray-900 dark:text-white font-bebas">Welcome to Timeloom</h3>
        <p className="text-center text-gray-600 dark:text-gray-400 mt-2">Sign in to continue</p>
        <div className="mt-8">
          <Button
            onClick={handleSignIn}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition duration-200 ease-in-out flex items-center justify-center space-x-2 shadow-md"
            disabled={isLoading}
          >
            {isLoading ? (
              'Signing In...'
            ) : (
              <>
                {/* <img src={googleIcon} /> */}
                Sign In with Google
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
