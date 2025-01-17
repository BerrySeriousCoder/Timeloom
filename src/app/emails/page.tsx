
import { useParams, Outlet, useSearchParams } from 'react-router-dom'; 
import EmailsHeader from '@/components/emails/EmailsHeader';

const EmailsPage = () => {
  const params = useParams(); // Get URL parameters
  const isViewingThread = !!params.threadId; // Check if threadId exists in path params
  const [searchParams] = useSearchParams(); // Get search params
  const isTagView = !!searchParams.get('tag') || !!searchParams.get('priority'); // Check if tag/priority param exists

  return (
    <div className="p-6 w-full">
      <EmailsHeader isViewingThread={isViewingThread} isTagView={isTagView} />
      <Outlet /> 
    </div>
  );
};

export default EmailsPage;
