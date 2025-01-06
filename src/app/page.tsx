
import { Suspense } from 'react';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import PersonalCard from '@/components/dashboard/PersonalCard';
import ImportantEmailsCard from '@/components/dashboard/ImportantEmailsCard';

const Dashboard = () => {
  return (
    <div className="p-6">
      
      <DashboardHeader />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Suspense fallback={<div>Loading...</div>}>
          <PersonalCard />
        </Suspense>
        
        <Suspense fallback={<div>Loading...</div>}>
          <ImportantEmailsCard />
        </Suspense>
      </div>
    </div>
  );
};

export default Dashboard;
