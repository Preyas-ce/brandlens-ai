import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthProvider';
import { hasUserSeenWelcome } from '@/services/welcomePreferences';
import {
  isPendingRegistrationTour,
  clearPendingRegistrationTour,
  hasUserCompletedEagleTour,
  markUserEagleTourCompleted,
  hasUserSkippedEagleTour,
  markUserEagleTourSkipped,
  saveActiveTourStep,
  getActiveTourStep,
} from '@/services/onboardingPreferences';
import { QUICK_SCAN_OPEN_EVENT, QUICK_SCAN_CLOSE_EVENT, EAGLE_TOUR_TRIGGER_EVENT } from '@/services/uiPreferences';

export { EAGLE_TOUR_TRIGGER_EVENT };

export type TourStepNumber = 1 | 2 | 3 | 4 | 5 | 6;

interface EagleTourContextValue {
  isActive: boolean;
  currentStep: TourStepNumber;
  isManualReplay: boolean;
  startTour: (step?: number, isManual?: boolean) => void;
  stopTour: (markCompleted?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  goToStep: (step: number) => void;
}

const EagleTourContext = createContext<EagleTourContextValue | null>(null);

export const EagleTourProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { session, loading: authLoading } = useAuth();
  const isDemo = typeof window !== 'undefined' && window.localStorage.getItem('brandlens.demo_mode') === 'true';
  const userId = session?.user?.id || (isDemo ? (window.localStorage.getItem('brandlens.demo_user_id') || 'demo-user') : undefined);
  const userEmail = session?.user?.email || (isDemo ? 'demo@brandlens.local' : undefined);

  const navigate = useNavigate();
  const location = useLocation();

  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<TourStepNumber>(1);
  const [isManualReplay, setIsManualReplay] = useState<boolean>(false);
  const hasAutoLaunched = useRef<boolean>(false);
  const quickScanTimerRef = useRef<number | null>(null);

  // Sync route on step transition
  const routeForStep = useCallback((step: TourStepNumber) => {
    switch (step) {
      case 1:
        return '/dashboard';
      case 2:
        return '/dashboard';
      case 3:
        return '/review?scenario=needs-review&reanalyze=1';
      case 4:
        return '/review';
      case 5:
        return '/approvals';
      case 6:
        return '/history';
      default:
        return '/dashboard';
    }
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      const clamped = Math.max(1, Math.min(6, step)) as TourStepNumber;
      setCurrentStep(clamped);
      saveActiveTourStep(userId, clamped);

      if (quickScanTimerRef.current !== null) {
        window.clearTimeout(quickScanTimerRef.current);
        quickScanTimerRef.current = null;
      }

      // Handle Quick Scan modal lifecycle
      if (clamped === 2) {
        if (location.pathname !== '/dashboard' && location.pathname !== '/') {
          navigate('/dashboard');
        }
        quickScanTimerRef.current = window.setTimeout(() => {
          window.dispatchEvent(new Event(QUICK_SCAN_OPEN_EVENT));
          quickScanTimerRef.current = null;
        }, 150);
      } else {
        // Deterministically close Quick Scan when leaving step 2
        window.dispatchEvent(new Event(QUICK_SCAN_CLOSE_EVENT));
        const targetRoute = routeForStep(clamped);
        if (!location.pathname.startsWith(targetRoute.split('?')[0])) {
          navigate(targetRoute);
        }
      }
    },
    [userId, location.pathname, navigate, routeForStep],
  );

  const startTour = useCallback(
    (initialStep = 1, isManual = false) => {
      setIsManualReplay(isManual);
      setIsActive(true);
      goToStep(initialStep);
    },
    [goToStep],
  );

  const stopTour = useCallback(
    (markCompleted = false) => {
      if (quickScanTimerRef.current !== null) {
        window.clearTimeout(quickScanTimerRef.current);
        quickScanTimerRef.current = null;
      }
      window.dispatchEvent(new Event(QUICK_SCAN_CLOSE_EVENT));
      setIsActive(false);
      if (markCompleted) {
        markUserEagleTourCompleted(userId);
      } else {
        markUserEagleTourSkipped(userId);
      }
      clearPendingRegistrationTour(userId, userEmail);
    },
    [userId, userEmail],
  );

  // Clean up any pending timer on unmount
  useEffect(() => {
    return () => {
      if (quickScanTimerRef.current !== null) {
        window.clearTimeout(quickScanTimerRef.current);
        quickScanTimerRef.current = null;
      }
    };
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < 6) {
      goToStep(currentStep + 1);
    } else {
      stopTour(true);
    }
  }, [currentStep, goToStep, stopTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const skipStep = useCallback(() => {
    if (currentStep < 6) {
      goToStep(currentStep + 1);
    } else {
      stopTour(true);
    }
  }, [currentStep, goToStep, stopTour]);

  // Check for newly registered account tour auto-launch
  useEffect(() => {
    if (authLoading || !userId || hasAutoLaunched.current) return;

    // Check if user is pending registration tour and has NOT completed or skipped it
    const isPending = isPendingRegistrationTour(userId, userEmail);
    const hasCompleted = hasUserCompletedEagleTour(userId);
    const hasSkipped = hasUserSkippedEagleTour(userId);
    const hasSeenWelcome = hasUserSeenWelcome(userId);

    // Chained sequence: Only start if user has finished/dismissed the welcome lamp
    if (isPending && !hasCompleted && !hasSkipped && hasSeenWelcome) {
      hasAutoLaunched.current = true;
      clearPendingRegistrationTour(userId, userEmail);
      const savedStep = getActiveTourStep(userId);
      startTour(savedStep, false);
    }
  }, [authLoading, userId, userEmail, startTour]);

  // Listen to manual triggers (e.g. from Overview "Replay Guided Tour" button)
  useEffect(() => {
    const handleTrigger = (event: Event) => {
      const customEvent = event as CustomEvent<{ step?: number }>;
      const targetStep = customEvent.detail?.step || 1;
      startTour(targetStep, true);
    };

    window.addEventListener(EAGLE_TOUR_TRIGGER_EVENT, handleTrigger);
    return () => {
      window.removeEventListener(EAGLE_TOUR_TRIGGER_EVENT, handleTrigger);
    };
  }, [startTour]);

  const value = {
    isActive,
    currentStep,
    isManualReplay,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    skipStep,
    goToStep,
  };

  return <EagleTourContext.Provider value={value}>{children}</EagleTourContext.Provider>;
};

export const useEagleTour = (): EagleTourContextValue => {
  const context = useContext(EagleTourContext);
  if (!context) {
    throw new Error('useEagleTour must be used inside an EagleTourProvider');
  }
  return context;
};
