import React, { useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ReviewRecord } from '@/types/review';
import { OpticalSentinel } from '@/components/brand/OpticalSentinel';

type OrbitFocus = 'analysis' | 'source' | 'human';

const RULE_LABELS: Record<string, string> = {
  'R-101': 'Superlatives',
  'R-102': 'Terminology',
  'R-103': 'Claims & Guarantees',
  'R-106': 'Accessibility',
};

const INSIGHT_RECOMMENDATIONS: Record<string, string> = {
  'R-101': 'Add approved comparative language and the evidence needed to substantiate it.',
  'R-102': 'Clarify the approved terminology and add examples to the workspace rulebook.',
  'R-103': 'Add pre-approved, evidence-backed claim phrasing to the Evidence Catalogue.',
  'R-106': 'Publish accessible CTA and image-description examples for creators.',
};

const ORBIT_DETAILS: Record<OrbitFocus, { label: string; description: string }> = {
  analysis: {
    label: 'AI analysis & insight',
    description: 'Local rules surface wording and evidence that may need a closer look.',
  },
  human: {
    label: 'Human judgement & verification',
    description: 'A reviewer considers the evidence and owns the final decision.',
  },
  source: {
    label: 'Source evidence',
    description: 'Approved sources help a reviewer assess the context and reliability of a claim.',
  },
};

export const BrandOrbit: React.FC<{ records?: ReviewRecord[]; motionPaused?: boolean }> = ({ records = [], motionPaused = false }) => {
  const [selected, setSelected] = useState<OrbitFocus | null>(null);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [rotation, setRotation] = useState({ x: -12, y: 18 });
  const dragOrigin = useRef<{ x: number; y: number; rotationX: number; rotationY: number } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const animationPlayState = isPaused || motionPaused || prefersReducedMotion ? 'paused' : 'running';
  const counts = new Map<string, number>();
  let totalFindings = 0;
  records.forEach((record) => record.findings.forEach((finding) => {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
    totalFindings += 1;
  }));
  const topFriction = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    dragOrigin.current = { x: event.clientX, y: event.clientY, rotationX: rotation.x, rotationY: rotation.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragOrigin.current) return;
    setRotation({
      x: Math.max(-48, Math.min(48, dragOrigin.current.rotationX + (event.clientY - dragOrigin.current.y) * -0.7)),
      y: dragOrigin.current.rotationY + (event.clientX - dragOrigin.current.x) * 0.7,
    });
  };
  const stopDragging = () => { dragOrigin.current = null; };

  return (
    <section className="relative mx-auto w-full max-w-[23rem] overflow-hidden border border-stone-300 bg-ivory-100/70 p-3 sm:p-4" aria-label="Brand Orbit: analysis and human verification">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-stone-600">Brand Orbit</span>
        {prefersReducedMotion ? (
          <span className="text-[8px] font-mono uppercase tracking-wider text-stone-500">Static view</span>
        ) : (
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-label={isPaused ? 'Resume Brand Orbit motion' : 'Pause Brand Orbit motion'}
            aria-pressed={isPaused}
            title={isPaused ? 'Resume orbit motion' : 'Pause orbit motion'}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[9px] text-stone-600 transition-colors hover:bg-ivory-300 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-95"
          >
            {isPaused ? <Play className="h-3 w-3" aria-hidden="true" /> : <Pause className="h-3 w-3" aria-hidden="true" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      <div
        className="relative mx-auto aspect-[1.5] w-full max-w-[19rem] cursor-grab touch-none select-none active:cursor-grabbing"
        aria-label="Interactive governance lens. Drag to rotate and select a node to inspect."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-stone-300/80" aria-hidden="true" />
        <div
          className="orbit-track absolute left-1/2 top-1/2 h-[96%] w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-copper/30"
          style={{ animationPlayState }}
          aria-hidden="true"
        />
        <div
          className="absolute left-1/2 top-1/2 grid h-44 w-56 -translate-x-1/2 -translate-y-1/2 place-items-center [perspective:520px]"
          aria-hidden="true"
        >
          <div className="transition-transform duration-100" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
            <OpticalSentinel compact paused={isPaused || motionPaused} />
          </div>
        </div>

        <button
          type="button"
          aria-pressed={selected === 'analysis'}
          aria-label="AI analysis and insight. Local rules surface wording and evidence that may need a closer look."
          onClick={() => setSelected((current) => current === 'analysis' ? null : 'analysis')}
          className={`orbit-node absolute left-[17%] top-[13%] z-10 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border border-copper/70 bg-obsidian text-copper-100 shadow-[0_7px_22px_rgba(188,116,78,0.18)] transition duration-200 hover:scale-110 hover:border-copper hover:shadow-[0_0_24px_rgba(188,116,78,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 active:scale-95 sm:h-20 sm:w-20 ${selected === 'analysis' ? 'scale-110 ring-2 ring-copper/80 ring-offset-2 ring-offset-ivory-100' : ''}`}
        >
          <span className="text-center">
            <span className="block text-[7px] font-mono uppercase tracking-wider text-copper-200">AI</span>
            <span className="mt-0.5 block text-[8px] font-semibold leading-tight text-ivory">Insight</span>
          </span>
        </button>

        <button
          type="button"
          aria-pressed={selected === 'source'}
          aria-label="Source evidence. Approved sources help a reviewer assess the context and reliability of a claim."
          onClick={() => setSelected((current) => current === 'source' ? null : 'source')}
          className={`orbit-node absolute right-[13%] top-[8%] z-10 grid h-14 w-14 place-items-center rounded-full border border-copper/50 bg-ivory text-center shadow-[0_7px_22px_rgba(188,116,78,0.14)] transition duration-200 hover:scale-110 hover:border-copper hover:shadow-[0_0_24px_rgba(188,116,78,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 active:scale-95 ${selected === 'source' ? 'scale-110 ring-2 ring-copper/70 ring-offset-2 ring-offset-ivory-100' : ''}`}
        >
          <span className="text-center">
            <span className="block text-[6px] font-mono uppercase tracking-wider text-copper-800">Source</span>
            <span className="mt-0.5 block text-[7px] font-semibold leading-tight text-obsidian">Evidence</span>
          </span>
        </button>

        <button
          type="button"
          aria-pressed={selected === 'human'}
          aria-label="Human judgement and verification. A reviewer considers the evidence and owns the final decision."
          onClick={() => setSelected((current) => current === 'human' ? null : 'human')}
          className={`orbit-node absolute bottom-[11%] right-[12%] z-10 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border border-forest/60 bg-forest text-ivory shadow-[0_7px_22px_rgba(36,76,58,0.2)] transition duration-200 hover:scale-110 hover:border-forest hover:shadow-[0_0_24px_rgba(36,76,58,0.32)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 active:scale-95 sm:h-20 sm:w-20 ${selected === 'human' ? 'scale-110 ring-2 ring-forest/70 ring-offset-2 ring-offset-ivory-100' : ''}`}
        >
          <span className="text-center">
            <span className="block text-[7px] font-mono uppercase tracking-wider text-ivory/70">Human</span>
            <span className="mt-0.5 block text-[8px] font-semibold leading-tight text-ivory">Judgement</span>
          </span>
        </button>
      </div>

      <div className="mt-1 flex min-h-[2.9rem] items-center justify-between gap-2 border-t border-stone-300/80 pt-2">
        <p className="min-w-0 text-[9px] leading-relaxed text-stone-600" aria-live="polite">
          {selected
            ? <><strong className="text-obsidian">{ORBIT_DETAILS[selected].label}:</strong> {ORBIT_DETAILS[selected].description}</>
            : 'Drag to rotate · Click nodes to inspect'}
        </p>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Reset Brand Orbit selection"
            title="Reset selection"
            className="shrink-0 rounded-sm p-1.5 text-stone-500 transition-colors hover:bg-ivory-300 hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-95"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="mt-2 border-t border-stone-200 pt-2">
        <p className="mb-1.5 text-[8px] font-mono font-bold uppercase tracking-[0.16em] text-stone-500">Top recurring friction points</p>
        {topFriction.length ? (
          <>
            <div className="flex flex-wrap gap-1">
              {topFriction.map(([ruleId, count]) => (
                <button
                  key={ruleId}
                  type="button"
                  aria-pressed={selectedRule === ruleId}
                  onClick={() => setSelectedRule((current) => current === ruleId ? null : ruleId)}
                  className={`border px-1.5 py-1 text-[8px] font-mono uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${selectedRule === ruleId ? 'border-copper bg-copper-50 text-copper-900' : 'border-stone-300 bg-ivory text-stone-600 hover:border-copper'}`}
                >
                  {RULE_LABELS[ruleId] ?? ruleId} · {count}
                </button>
              ))}
            </div>
            {selectedRule && (
              <div className="mt-2 border-l-2 border-copper bg-copper-50/70 px-2.5 py-2" aria-live="polite">
                <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-copper-900">Governance insight · {selectedRule}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-stone-700">
                  {selectedRule} accounts for {Math.round(((counts.get(selectedRule) ?? 0) / totalFindings) * 100)}% of recorded findings. {INSIGHT_RECOMMENDATIONS[selectedRule] ?? 'Review this rule and add clearer examples to the workspace guidance.'}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-[9px] leading-relaxed text-stone-500">Findings across saved analyses will reveal repeated friction here.</p>
        )}
      </div>
    </section>
  );
};
