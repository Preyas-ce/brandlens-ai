import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { AuthProvider } from '@/contexts/AuthProvider';
import { LanguageProvider } from '@/contexts/LanguageProvider';

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AuthProvider>
    </LanguageProvider>
  );
};

export default App;
