import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpenCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EditorialTaskLamp } from '@/components/brand/EditorialTaskLamp';
import { useLanguage } from '@/contexts/LanguageProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface FirstSignInWelcomeProps {
  onComplete: () => void;
  userEmail?: string;
  workspaceName?: string;
  durationMs?: number;
}

export const FirstSignInWelcome: React.FC<FirstSignInWelcomeProps> = ({
  onComplete,
  userEmail,
  workspaceName,
  durationMs = 2800,
}) => {
  const { t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const [isLit, setIsLit] = useState(prefersReducedMotion);
  const [progressWidth, setProgressWidth] = useState(prefersReducedMotion ? 100 : 0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!prefersReducedMotion) {
      // Gentle reveal transition
      const lightTimer = window.setTimeout(() => setIsLit(true), 250);
      const progressTimer = window.setTimeout(() => setProgressWidth(100), 300);

      timerRef.current = window.setTimeout(() => {
        onComplete();
      }, durationMs);

      return () => {
        window.clearTimeout(lightTimer);
        window.clearTimeout(progressTimer);
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    } else {
      setIsLit(true);
      timerRef.current = window.setTimeout(onComplete, durationMs);
      return () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      };
    }
  }, [durationMs, onComplete, prefersReducedMotion]);

  // Keyboard shortcut: Escape or Enter
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onComplete();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('welcomeStudioReady')}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-obsidian-950/95 backdrop-blur-md px-5 py-8 text-ivory animate-fade-in select-none"
    >
      {/* Background architectural glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] bg-[radial-gradient(#F6F1E8_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full bg-copper/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center">
        {/* Lamp Centerpiece */}
        <div className="w-48 sm:w-56 aspect-square mb-2 transition-transform duration-700">
          <EditorialTaskLamp
            isLit={isLit}
            interactive={false}
            idPrefix="welcome-lamp"
            ariaLabel="BrandLens studio task lamp"
          />
        </div>

        {/* Workspace Identity Tag */}
        <div className="inline-flex items-center gap-2 border border-stone-700/80 bg-obsidian-900/80 px-3 py-1 rounded-sm text-[10px] font-mono uppercase tracking-[0.18em] text-copper-300 mb-4 shadow-sm">
          <Sparkles className="h-3 w-3 text-copper" />
          <span>{workspaceName || 'Editorial Studio'}</span>
          {userEmail && (
            <>
              <span className="text-stone-600">•</span>
              <span className="lowercase tracking-normal text-stone-400">{userEmail}</span>
            </>
          )}
        </div>

        {/* Welcome Headline */}
        <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal leading-[1.08] tracking-tight text-ivory">
          {t('welcomeStudioReady')}
        </h2>

        {/* Value Proposition Reminder */}
        <p className="mt-4 text-xs sm:text-sm text-stone-300 leading-relaxed max-w-lg font-sans">
          {t('welcomeStudioDescription')}
        </p>

        {/* Pillars Summary Micro-bar */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono uppercase tracking-wider text-stone-400 border-y border-stone-800/80 py-2.5 w-full max-w-md">
          <span className="flex items-center gap-1.5">
            <BookOpenCheck className="h-3.5 w-3.5 text-copper" />
            <span>Deterministic Rules</span>
          </span>
          <span className="text-stone-700">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-forest-400" />
            <span>Human Gate Enforced</span>
          </span>
        </div>

        {/* Actions Row */}
        <div className="mt-8 flex items-center justify-center gap-4 w-full max-w-xs">
          <Button
            autoFocus
            variant="copper"
            size="md"
            onClick={onComplete}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
            className="flex-1 justify-center shadow-lg"
          >
            {t('welcomeContinueBtn')}
          </Button>

          <button
            type="button"
            onClick={onComplete}
            className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-stone-400 hover:text-ivory transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 rounded-sm"
          >
            {t('welcomeSkipBtn')}
          </button>
        </div>

        {/* Progress Bar & Auto-navigation Notice */}
        <div className="mt-6 w-full max-w-xs">
          <div className="h-0.5 w-full bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-copper transition-all ease-linear"
              style={{
                width: `${progressWidth}%`,
                transitionDuration: prefersReducedMotion ? '0ms' : `${durationMs - 300}ms`,
              }}
            />
          </div>
          <p className="mt-2 text-[9px] font-mono text-stone-500 uppercase tracking-widest">
            {t('welcomeAutoRedirectNotice')}
          </p>
        </div>
      </div>
    </div>
  );
};
