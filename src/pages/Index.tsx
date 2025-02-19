import { Suspense, useState, useEffect } from 'react'; 
import GoogleAuth from '@/components/auth/GoogleAuth';
import { useAuth } from '@/components/providers/AuthProvider';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import PersonalCard from '@/components/dashboard/PersonalCard';
import ImportantEmailsCard from '@/components/dashboard/ImportantEmailsCard';
import AddCardDialog from '@/components/dashboard/AddCardDialog'; 
import CustomCardComponent from '@/components/dashboard/CustomCard'; 
import { getCards, CustomCard } from '@/lib/cardApi'; 
import { useToast } from '@/components/ui/use-toast'; 
import { Button } from '@/components/ui/button'; 
import { Plus } from 'lucide-react'; 

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [customCards, setCustomCards] = useState<CustomCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to fetch cards
  const loadCards = async () => {
    if (!isAuthenticated) {
      setCustomCards([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedCards = await getCards();
      setCustomCards(fetchedCards);
    } catch (err) {
      console.error("Failed to fetch custom cards:", err);
      const errorMessage = err instanceof Error ? err.message : "Could not fetch custom cards.";
      setError("Failed to load custom cards. Please try again later.");
      toast({
        title: "Error Fetching Cards",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch cards on mount and when auth state changes
  useEffect(() => {
    loadCards();
  }, [isAuthenticated]); // Removed toast dependency as it's stable

  // Callback handlers for real-time updates
  const handleCardAdded = (newCard: CustomCard) => {
    // Instead of adding the potentially incomplete newCard, reload the list
    // to get the card with its tags properly populated from the DB.
    loadCards();
    // Optionally, you could still add optimistically and then refresh,
    // but reloading ensures data consistency.
  };

  const handleCardUpdated = (updatedCard: CustomCard) => {
    setCustomCards(prevCards =>
      prevCards.map(card => (card.id === updatedCard.id ? updatedCard : card))
    );
  };

  const handleCardDeleted = (id: string) => {
    setCustomCards(prevCards => prevCards.filter(card => card.id !== id));
  };

  return (
    <div className="p-6 w-full">

      {isAuthenticated ? (
        <>
          <div className="flex justify-between items-center mb-6">
             <DashboardHeader />
             {/* Add Card Button/Dialog */}
             <AddCardDialog onCardAdded={handleCardAdded}>
               <Button className="bg-purple hover:bg-purple-dark">
                 <Plus className="mr-2 h-4 w-4" /> Add Custom Card
               </Button>
             </AddCardDialog>
           </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Suspense fallback={<div>Loading...</div>}>
              <PersonalCard />
            </Suspense>

            <Suspense fallback={<div className="font-mulish">Loading...</div>}>
              <ImportantEmailsCard />
            </Suspense>
          </div>

          {/* Custom Cards Section */}
          <div className="mt-6">
             <h2 className="text-xl font-semibold mb-4 font-dmSans">My Custom Cards</h2>
             {isLoading && <div className="font-mulish">Loading custom cards...</div>}
             {error && <div className="text-red-500 font-mulish">{error}</div>}
             {!isLoading && !error && customCards.length === 0 && (
               <p className="text-muted-foreground font-mulish">You haven't added any custom cards yet. Click "Add Custom Card" to create one.</p>
             )}
             {!isLoading && !error && customCards.length > 0 && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {customCards.map(card => (
                   <CustomCardComponent
                     key={card.id}
                     card={card}
                     onUpdate={handleCardUpdated}
                     onDelete={handleCardDeleted}
                     className="min-h-[200px]" // Example: Set a min-height to match others roughly
                   />
                 ))}
               </div>
             )}
           </div>
        </>
      ) : (
        <GoogleAuth />
      )}
    </div>
  );
};

export default Index;
