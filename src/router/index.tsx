import { createBrowserRouter } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ActivityPage } from '@/pages/ActivityPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { GuidelinesPage } from '@/pages/GuidelinesPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'activity',
        element: <ActivityPage />,
      },
      {
        path: 'review',
        element: <ReviewPage />,
      },
      {
        path: 'guidelines',
        element: <GuidelinesPage />,
      },
      {
        path: 'approvals',
        element: <ApprovalsPage />,
      },
      {
        path: 'approvals/:reviewId',
        element: <ApprovalsPage />,
      },
      {
        path: 'history',
        element: <HistoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
