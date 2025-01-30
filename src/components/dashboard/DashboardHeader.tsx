import { Plus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AddCardDialog from './AddCardDialog';
import { useAuth } from '@/components/providers/AuthProvider';

const DashboardHeader = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="flex justify-between items-center flex-wrap gap-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold font-bebas">Dashboard</h1>
        {user && (
          <span className="text-sm text-muted-foreground">
            Welcome, {user.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
      </div>
    </div>
  );
};

export default DashboardHeader;
