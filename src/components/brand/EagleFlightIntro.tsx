import React, { useEffect, useState, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageProvider';
import { X, Sparkles } from 'lucide-react';

interface EagleFlightIntroProps {
  userId?: string | null;
  workspaceId?: string | null;
  actionInterrupted?: boolean;
}

const FLIGHT_SHOWN_KEY_PREFIX = 'brandlens.import_eagle_flight.v1.';

export const hasUserSeenImportFlight = (userId?: string | null, workspaceId?: string | null): boolean => {
  if (!userId || !workspaceId) return false;
  try {
    return window.localStorage.getItem(`${FLIGHT_SHOWN_KEY_PREFIX}${userId}.${workspaceId}`) === 'true';
  } catch {
    return false;
  }
};

export const markUserImportFlightSeen = (userId?: string | null, workspaceId?: string | null): void => {
  if (!userId || !workspaceId) return;
  try {
    window.localStorage.setItem(`${FLIGHT_SHOWN_KEY_PREFIX}${userId}.${workspaceId}`, 'true');
  } catch {
    // Graceful fallback
  }
};

export const EagleFlightIntro: React.FC<EagleFlightIntroProps> = ({
  userId,
  workspaceId,
  actionInterrupted = false,
}) => {
  const { t } = useLanguage();
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const alreadySeen = hasUserSeenImportFlight(userId, workspaceId);

  // Phase: 'flying' | 'perched'
  const [phase, setPhase] = useState<'flying' | 'perched'>(() => {
    if (alreadySeen || prefersReducedMotion || actionInterrupted) {
      return 'perched';
    }
    return 'flying';
  });

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'flying') {
      timerRef.current = window.setTimeout(() => {
        setPhase('perched');
        markUserImportFlightSeen(userId, workspaceId);
      }, 2700);
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [phase, userId, workspaceId]);

  // If user triggers an import action during flight, immediately settle
  useEffect(() => {
    if (actionInterrupted && phase === 'flying') {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      setPhase('perched');
      markUserImportFlightSeen(userId, workspaceId);
    }
  }, [actionInterrupted, phase, userId, workspaceId]);

  return (
    <div className="relative mb-6">
      {/* 1. Dynamic Flight Animation Layer (Active only during 'flying' phase) */}
      {phase === 'flying' && (
        <div
          className="pointer-events-none absolute -inset-6 z-20 overflow-hidden"
          aria-hidden="true"
        >
          <div className="animate-eagle-flight absolute top-4 right-4 flex items-center justify-center">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full border-2 border-copper bg-obsidian shadow-2xl overflow-hidden ring-4 ring-forest/30">
              <img
                src="/mascot-eagle.jpg"
                alt="BrandLens Eagle Mascot"
                className="h-full w-full object-cover object-top"
              />
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-forest border-2 border-ivory" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Settled Perch & Editorial Speech Bubble */}
      {phase === 'perched' && !bubbleDismissed && (
        <aside
          role="region"
          aria-label="BrandLens Eagle Guide Welcome"
          className="animate-speech-bubble flex flex-col sm:flex-row items-start sm:items-center gap-3.5 border border-forest/30 bg-forest-50/70 p-3 sm:p-4 rounded-[3px] shadow-xs"
        >
          {/* Perched Mascot Avatar */}
          <div className="relative h-12 w-12 sm:h-13 sm:w-13 shrink-0 rounded-full border-2 border-forest overflow-hidden shadow-xs bg-obsidian">
            <img
              src="/mascot-eagle.jpg"
              alt="BrandLens Eagle Mascot"
              className="h-full w-full object-cover object-top"
            />
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-forest border-2 border-ivory"
              title="Eagle Perched"
              aria-hidden="true"
            />
          </div>

          {/* Speech Bubble Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-3 w-3 text-copper shrink-0" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-forest-800">
                {t('importEagleGuideBadge') || 'BrandLens Guide'}
              </span>
            </div>
            <p className="font-serif text-xs sm:text-sm font-normal text-obsidian leading-snug">
              “{t('importEagleGreeting') || 'Welcome to BrandLens! Would you like to bring your existing local reviews into your workspace, or start fresh in the cloud?'}”
            </p>
          </div>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={() => setBubbleDismissed(true)}
            aria-label="Dismiss guide message"
            className="self-start sm:self-center p-1 rounded-xs text-stone-400 hover:text-obsidian hover:bg-forest-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </aside>
      )}
    </div>
  );
};