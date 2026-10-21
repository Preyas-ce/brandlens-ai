import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, LampDesk } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { OpticalSentinel } from '@/components/brand/OpticalSentinel';

interface IlluminationIntroProps {
  onComplete: () => void;
  storageError: string;
}

export const IlluminationIntro: React.FC<IlluminationIntroProps> = ({ onComplete, storageError }) => {
  const [isLit, setIsLit] = useState(false);
  const pullRef = useRef<HTMLButtonElement>(null);
  const completionTimer = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [showLensNote, setShowLensNote] = useState(false);

  useEffect(() => {
    pullRef.current?.focus();
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
      className={`illumination-scene fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto px-5 py-16 text-ivory transition-opacity duration-1000 ease-out ${isLit ? 'is-lit pointer-events-none opacity-0' : 'opacity-100'}`}
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
          {storageError && <p role="status" className="mx-auto mt-4 max-w-lg text-left text-[10px] leading-relaxed text-copper-200 lg:mx-0">{storageError}</p>}
        </div>

        <div className="order-1 mx-auto flex w-full max-w-[25rem] flex-col items-center lg:order-2">
          <div className="lamp-illustration relative aspect-square w-full">
            <div className="illumination-floor absolute inset-x-[8%] bottom-[8%] h-[18%] rounded-[50%] border border-white/[0.06] bg-obsidian-950/30 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]" aria-hidden="true" />
            <div className="illumination-reflection absolute inset-x-[23%] bottom-[14%] h-[9%] rounded-[50%] bg-copper/0 blur-2xl transition-colors duration-700" aria-hidden="true" />
            <svg viewBox="0 0 360 390" className="absolute inset-0 h-full w-full drop-shadow-[0_18px_18px_rgba(0,0,0,0.38)]" role="img" aria-label="A hanging sculptural lamp with a pull cord">
              <defs>
                <linearGradient id="lamp-metal" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#625e55" />
                  <stop offset=".48" stopColor="#2b2c27" />
                  <stop offset="1" stopColor="#11130f" />
                </linearGradient>
                <linearGradient id="lamp-shade" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#163528" />
                    <stop offset=".48" stopColor="#2d5943" />
                    <stop offset="1" stopColor="#17392c" />
                </linearGradient>
                  <linearGradient id="lamp-brass" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#805a3e" />
                    <stop offset=".5" stopColor="#d2a46d" />
                    <stop offset="1" stopColor="#775136" />
                  </linearGradient>
                <radialGradient id="lamp-bulb">
                  <stop offset="0" stopColor="#fff1c7" stopOpacity=".98" />
                  <stop offset=".42" stopColor="#e9b777" stopOpacity=".82" />
                  <stop offset="1" stopColor="#bc744e" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="light-beam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#edc58e" stopOpacity=".24" />
                  <stop offset="1" stopColor="#edc58e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="lamp-beam" d="M106 142 L254 142 L319 345 Q180 381 41 345 Z" fill="url(#light-beam)" />
              <path d="M180 0v64" fill="none" stroke="#8b8170" strokeWidth="2.5" />
              <path d="M177.5 0v63M182.5 0v63" fill="none" stroke="#c2a274" strokeOpacity=".62" strokeWidth=".7" />
              <path d="M154 8h52v5h-52z" fill="url(#lamp-brass)" />
              <path d="M162 65h36v8h-36z" rx="2" fill="url(#lamp-brass)" stroke="#e1bd8a" strokeOpacity=".5" />
              <path d="M166 72q14-5 28 0l58 69q-72 26-144 0z" fill="url(#lamp-shade)" stroke="#c59a68" strokeOpacity=".7" strokeWidth="1.5" />
              <path d="M166 75q14 5 28 0" fill="none" stroke="#e5c48f" strokeWidth="2" />
              <path d="M108 141q72 23 144 0" fill="none" stroke="#d1aa78" strokeWidth="3" />
              <path d="M119 142q61 18 122 0l-20 15q-41 12-82 0z" fill="#e9bd80" fillOpacity=".38" />
              <ellipse className="lamp-bulb-glow" cx="180" cy="151" rx="43" ry="30" fill="url(#lamp-bulb)" />
              <path d="M169 135h22l-3 17q-8 8-16 0z" fill="#dbc18e" />
              <path className="lamp-pull-cord" d="M245 126q15 20 15 37v27" fill="none" stroke="#d0bc98" strokeWidth="1.6" />
              <path d="M260 190v13" fill="none" stroke="#d0bc98" strokeWidth="1.6" />
              <ellipse cx="260" cy="208" rx="7" ry="10" fill="url(#lamp-brass)" stroke="#edc48c" strokeWidth="1" />
              <path d="M51 344q129 27 258 0" fill="none" stroke="#bd9069" strokeOpacity=".18" strokeWidth="1" />
            </svg>
            <button
              ref={pullRef}
              type="button"
              onClick={illuminate}
              disabled={isLit}
              aria-label="Pull the cord to illuminate your workspace"
              className="lamp-pull group absolute inset-[6%] z-10 min-w-[120px] cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian disabled:pointer-events-none"
            >
              <span className="pointer-events-none absolute left-1/2 top-[27%] -translate-x-1/2 whitespace-nowrap border border-stone-500/70 bg-obsidian/90 px-2 py-1 text-[8px] font-mono text-ivory opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Click or pull cord to illuminate</span>
            </button>
            <span className="absolute bottom-[1%] left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[9px] font-mono uppercase tracking-[0.18em] text-stone-500">
              {isLit ? 'Workspace illuminated' : 'Pull the cord to illuminate your workspace'}
            </span>
          </div>
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
