import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, LampDesk } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { OpticalSentinel } from '@/components/brand/OpticalSentinel';
import { EditorialTaskLamp } from '@/components/brand/EditorialTaskLamp';

interface IlluminationIntroProps {
  onComplete: () => void;
  storageError: string;
}

export const IlluminationIntro: React.FC<IlluminationIntroProps> = ({ onComplete, storageError }) => {
  const [isLit, setIsLit] = useState(false);
  const completionTimer = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [showLensNote, setShowLensNote] = useState(false);

  useEffect(() => {
    return () => {
      if (completionTimer.current !== null) window.clearTimeout(completionTimer.current);
    };
  }, []);

  const illuminate = () => {
    if (isLit) return;
    setIsLit(true);
    if (prefersReducedMotion) {
      onComplete();
      return;
    }
    completionTimer.current = window.setTimeout(onComplete, 1250);
  };

  return (
    <section
      className={`illumination-scene fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto px-5 py-16 text-ivory transition-opacity duration-1000 ease-out ${
        isLit ? 'is-lit pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-label="BrandLens AI illumination introduction"
      aria-hidden={isLit}
    >
      <div className="illumination-grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="illumination-halo pointer-events-none absolute inset-0" aria-hidden="true" />
      <button
        type="button"
        onClick={onComplete}
        className="absolute right-5 top-5 z-20 inline-flex items-center gap-2 border border-stone-500/60 bg-obsidian-900/80 px-3 py-2 text-xs text-stone-300 transition-colors hover:border-copper hover:text-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian active:scale-[0.98]"
      >
        Skip intro <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
        <div className="order-2 text-center lg:order-1 lg:text-left">
          <p className="mb-4 text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-copper-200">
            BrandLens AI <span className="mx-2 text-stone-500">/</span> Editorial clarity
          </p>
          <h1 className="max-w-xl font-serif text-4xl font-normal leading-[1.05] tracking-tight text-ivory sm:text-5xl lg:text-6xl">
            Bring every word into the light.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-stone-300 sm:text-base lg:mx-0">
            A closer look can reveal the claims, evidence, and decisions that shape a brand. Begin with a little illumination.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-stone-400">
              <span className="h-1.5 w-1.5 rounded-full bg-forest-300" aria-hidden="true" />
              Local analysis · Human sign-off
            </span>
          </div>
          <div className="mt-4 flex min-h-32 items-center justify-center gap-2 overflow-hidden border-y border-stone-700/70 py-2 lg:justify-start">
            <OpticalSentinel compact />
            <button
              type="button"
              onClick={() => setShowLensNote((shown) => !shown)}
              aria-pressed={showLensNote}
              className="max-w-24 shrink-0 text-left text-[8px] font-mono leading-relaxed text-stone-400 hover:text-copper-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              {showLensNote ? 'AI insight · Source evidence · Human gate' : 'Optical Sentinel · Cursor tracking'}
            </button>
          </div>
          {storageError && (
            <p role="status" className="mx-auto mt-4 max-w-lg text-left text-[10px] leading-relaxed text-copper-200 lg:mx-0">
              {storageError}
            </p>
          )}
        </div>

        <div className="order-1 mx-auto flex w-full max-w-[25rem] flex-col items-center lg:order-2">
          <EditorialTaskLamp
            isLit={isLit}
            interactive={!isLit}
            onPull={illuminate}
            idPrefix="intro-lamp"
            ariaLabel="Interactive task lamp to illuminate your workspace"
          />
          <div className="mt-2 flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-stone-500" aria-hidden="true">
            <span className="h-px w-8 bg-copper/50" />
            <LampDesk className="h-3.5 w-3.5 text-copper" />
            <span>A considered first look</span>
            <span className="h-px w-8 bg-copper/50" />
          </div>
        </div>
      </div>
    </section>
  );
};
