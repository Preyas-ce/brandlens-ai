import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { IlluminationIntro } from '@/components/brand/IlluminationIntro';
import { EditorialFieldCanvas } from '@/components/brand/EditorialFieldCanvas';
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [intro, setIntro] = useState<IntroState>(getInitialIntroState);
  const [motionPaused, setMotionPaused] = useState(false);

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

  return (
    <div className="relative isolate min-h-screen bg-ivory text-obsidian flex flex-col md:flex-row antialiased selection:bg-copper/25 selection:text-obsidian">
      <EditorialFieldCanvas paused={motionPaused} />
      <div
        className={`relative z-10 flex min-h-screen w-full flex-col transition-opacity duration-700 ease-out md:flex-row ${intro.isVisible ? 'pointer-events-none invisible opacity-0' : 'visible opacity-100'}`}
        aria-hidden={intro.isVisible}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-transparent">
          <TopBar onOpenMobileSidebar={() => setMobileOpen(true)} />

          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 focus:outline-none sm:p-6 lg:p-8">
            <Outlet />
          </main>

          <footer className="flex select-none flex-col items-center justify-between gap-3 border-t-2 border-t-copper/25 border-stone-200/80 bg-ivory-100/70 px-4 py-3.5 text-xs text-stone-600 sm:flex-row md:px-8">
            <div className="flex items-center gap-2 text-[11px] font-sans">
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
      {intro.isVisible && <IlluminationIntro onComplete={completeIntro} storageError={intro.error} />}
      {!intro.isVisible && intro.error && (
        <p role="alert" className="fixed bottom-3 left-3 z-[90] max-w-sm border border-copper/50 bg-obsidian px-3 py-2 text-[10px] leading-relaxed text-copper-100 shadow-lg">
          {intro.error}
        </p>
      )}
    </div>
  );
};
