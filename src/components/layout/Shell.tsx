import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { IlluminationIntro } from '@/components/brand/IlluminationIntro';
import { FirstSignInWelcome } from '@/components/brand/FirstSignInWelcome';
import { EditorialFieldCanvas } from '@/components/brand/EditorialFieldCanvas';
import { WorkspaceAccessGate } from '@/components/layout/WorkspaceAccessGate';
import { useAuth } from '@/contexts/AuthProvider';
import { hasUserSeenWelcome, markUserWelcomeSeen } from '@/services/welcomePreferences';
import { EagleTourProvider } from '@/contexts/EagleTourContext';
import { EagleTourOverlay } from '@/components/brand/EagleTourOverlay';
import {
  ILLUMINATION_PREFERENCE_KEY,
  ILLUMINATION_REPLAY_EVENT,
  MOTION_PAUSE_EVENT,
} from '@/services/uiPreferences';

interface IntroState {
  isVisible: boolean;
  error: string;
}

const getInitialIntroState = (): IntroState => {
  try {
    return {
      isVisible: window.localStorage.getItem(ILLUMINATION_PREFERENCE_KEY) !== 'complete',
      error: '',
    };
  } catch (error) {
    return {
      isVisible: true,
      error: `The intro preference could not be read: ${error instanceof Error ? error.message : 'browser storage is unavailable.'}`,
    };
  }
};

export const Shell: React.FC = () => {
  const location = useLocation();
  const auth = useAuth();
  const isDemo = typeof window !== 'undefined' && window.localStorage.getItem('brandlens.demo_mode') === 'true';
  const userId = auth.session?.user?.id || (isDemo ? (window.localStorage.getItem('brandlens.demo_user_id') || 'demo-user') : undefined);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [intro, setIntro] = useState<IntroState>(getInitialIntroState);
  const [motionPaused, setMotionPaused] = useState(false);
  const [welcomeNeeded, setWelcomeNeeded] = useState(() => Boolean(userId && !hasUserSeenWelcome(userId)));

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  React.useEffect(() => {
    if (userId && !hasUserSeenWelcome(userId)) {
      setWelcomeNeeded(true);
    }
  }, [userId]);

  React.useEffect(() => {
    const replayIllumination = () => setIntro((current) => ({ ...current, isVisible: true, error: '' }));
    const setMotion = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      setMotionPaused(Boolean(customEvent.detail));
    };
    window.addEventListener(ILLUMINATION_REPLAY_EVENT, replayIllumination);
    window.addEventListener(MOTION_PAUSE_EVENT, setMotion);
    return () => {
      window.removeEventListener(ILLUMINATION_REPLAY_EVENT, replayIllumination);
      window.removeEventListener(MOTION_PAUSE_EVENT, setMotion);
    };
  }, []);

  const completeIntro = () => {
    setIntro((current) => ({ ...current, isVisible: false }));
    try {
      window.localStorage.setItem(ILLUMINATION_PREFERENCE_KEY, 'complete');
      setIntro((current) => ({ ...current, error: '' }));
    } catch (error) {
      setIntro((current) => ({
        ...current,
        error: `The intro was skipped, but this preference could not be saved: ${error instanceof Error ? error.message : 'browser storage is unavailable.'}`,
      }));
    }
  };

  const completeWelcome = () => {
    if (userId) markUserWelcomeSeen(userId);
    completeIntro();
    setWelcomeNeeded(false);
  };

  return (
    <WorkspaceAccessGate>
      <EagleTourProvider>
        <div className="relative isolate min-h-screen md:min-h-[100dvh] bg-ivory text-obsidian flex flex-col md:flex-row items-stretch antialiased selection:bg-copper/25 selection:text-obsidian overflow-x-clip">
          <EditorialFieldCanvas paused={motionPaused} />
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(!collapsed)}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />
          <div className="flex-1 flex flex-col min-w-0">
            <TopBar onOpenMobileSidebar={() => setMobileOpen(true)} />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
              <Outlet />
            </main>
            <footer className="border-t border-stone-200/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
              <div className="flex items-center gap-2">
                <span className="font-serif italic font-medium text-obsidian">BrandLens AI</span>
                <span className="text-stone-400">/</span>
                <span>Pre-Publication Editorial Intelligence & Governance</span>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-wider text-stone-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-forest" aria-hidden="true" />
                  <span>Human Gate Enforced</span>
                </span>
                <span className="text-stone-300">•</span>
                <span>Local Deterministic Engine</span>
              </div>
            </footer>
          </div>
        </div>

        <EagleTourOverlay />

        {welcomeNeeded && (
          <FirstSignInWelcome
            userEmail={auth.session?.user?.email}
            workspaceName={auth.workspace?.name}
            onComplete={completeWelcome}
          />
        )}

        {!welcomeNeeded && intro.isVisible && (
          <IlluminationIntro onComplete={completeIntro} storageError={intro.error} />
        )}

        {!welcomeNeeded && !intro.isVisible && intro.error && (
          <p role="alert" className="fixed bottom-3 left-3 z-[90] max-w-sm border border-copper/50 bg-obsidian px-3 py-2 text-[10px] leading-relaxed text-copper-100 shadow-lg">
            {intro.error}
          </p>
        )}
      </EagleTourProvider>
    </WorkspaceAccessGate>
  );
};
