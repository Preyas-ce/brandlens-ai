import React, { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ReviewFinding } from '@/types/review';

type GuidelineConcept = 'rules' | 'evidence' | 'human';

interface GuidelineGeometryProps {
  findings?: ReviewFinding[];
  gateStrictness?: 'strict' | 'flexible';
  onSelect?: (concept: GuidelineConcept) => void;
}

export const GuidelineGeometry: React.FC<GuidelineGeometryProps> = ({ findings = [], gateStrictness = 'strict', onSelect }) => {
  const [selected, setSelected] = useState<GuidelineConcept | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const animationPlayState = isPaused || prefersReducedMotion ? 'paused' : 'running';
  const choose = (concept: GuidelineConcept) => {
    setSelected((current) => current === concept ? null : concept);
    onSelect?.(concept);
  };
  const matchedRuleIds = [...new Set(findings.map((finding) => finding.ruleId))];
  const unverifiedCount = findings.filter((finding) => finding.evidenceStatus === 'unverified').length;
  const detail = selected === 'rules'
    ? matchedRuleIds.length
      ? `Active matched rules: ${matchedRuleIds.join(', ')}. Select this node to locate their highlighted phrases and finding cards.`
      : 'No active rule matched this revision. The rulebook remains guidance, not an independent proof of factual accuracy.'
    : selected === 'evidence'
      ? unverifiedCount
        ? `${unverifiedCount} claim${unverifiedCount === 1 ? ' is' : 's are'} Unverified because no applicable verified catalogue source was found. Missing evidence is not proof that a claim is false.`
        : 'Evidence references help assess claims. No finding in this revision is currently marked Unverified.'
      : selected === 'human'
        ? `Human verification remains the final authority. Current policy: ${gateStrictness === 'strict' ? 'Strict Gate — elevated findings receive priority attention.' : 'Advisory Gate — findings inform review but do not determine the decision.'}`
        : '';

  return (
    <section className="relative mt-4 overflow-hidden border-t border-stone-200 pt-3" aria-label="Guideline Geometry">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-copper">Guideline Geometry</p>
          <p className="mt-0.5 text-[9px] text-stone-500">A relationship of standards, sources, and human judgement.</p>
        </div>
        {prefersReducedMotion ? (
          <span className="text-[8px] font-mono uppercase tracking-wider text-stone-500">Static view</span>
        ) : (
          <button
            type="button"
            onClick={() => setIsPaused((paused) => !paused)}
            aria-label={isPaused ? 'Resume Guideline Geometry motion' : 'Pause Guideline Geometry motion'}
            aria-pressed={isPaused}
            title={isPaused ? 'Resume geometry motion' : 'Pause geometry motion'}
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[8px] text-stone-600 transition-colors hover:bg-ivory-100 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-95"
          >
            {isPaused ? <Play className="h-3 w-3" aria-hidden="true" /> : <Pause className="h-3 w-3" aria-hidden="true" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>

      <div className="relative mt-2 h-28 overflow-visible rounded-[2px] border border-stone-200/80 bg-ivory-100/55">
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="-24 -24 528 208" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path d="M90 100Q170 12 240 80T390 68" fill="none" stroke="#A8A095" strokeOpacity=".55" strokeWidth="1" />
          <path d="M90 100Q210 154 390 68" fill="none" stroke="#BC744E" strokeOpacity=".3" strokeWidth="1" strokeDasharray="3 5" />
          <circle cx="240" cy="80" r="49" fill="none" stroke="#244C3A" strokeOpacity=".2" strokeWidth="1" />
          <circle className="geometry-orbit" cx="240" cy="80" r="63" fill="none" stroke="#BC744E" strokeOpacity=".34" strokeWidth="1" strokeDasharray="2 8" style={{ animationPlayState }} />
          <circle cx="90" cy="100" r="28" fill="#BC744E" fillOpacity=".08" />
          <polygon points="240,48 269,98 211,98" fill="#244C3A" fillOpacity=".09" />
          <rect x="366" y="44" width="48" height="48" fill="#BC744E" fillOpacity=".08" />
        </svg>
        <button
          type="button"
          onClick={() => choose('rules')}
          aria-pressed={selected === 'rules'}
          aria-label="Brand rules: active guidelines set the standards used in a local analysis."
          style={{ animationPlayState }}
          className={`geometry-node absolute left-[13%] top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-copper/60 bg-ivory text-[8px] font-mono uppercase tracking-wide text-obsidian shadow-sm transition duration-200 hover:scale-110 hover:border-copper hover:shadow-[0_0_16px_rgba(188,116,78,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 active:scale-95 ${selected === 'rules' ? 'scale-110 ring-2 ring-copper/70 ring-offset-1' : ''}`}
        >Rules</button>
        <button
          type="button"
          onClick={() => choose('evidence')}
          aria-pressed={selected === 'evidence'}
          aria-label="Supporting evidence: catalogue references help a reviewer assess specific claims."
          style={{ animationPlayState }}
          className={`geometry-node absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center border border-forest/60 bg-forest/95 text-center text-[7px] font-mono uppercase leading-tight tracking-wide text-ivory shadow-sm transition duration-200 hover:scale-110 hover:border-forest hover:shadow-[0_0_16px_rgba(36,76,58,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 active:scale-95 [clip-path:polygon(50%_0%,100%_100%,0%_100%)] ${selected === 'evidence' ? 'scale-110 drop-shadow-[0_0_10px_rgba(36,76,58,0.3)]' : ''}`}
        ><span className="mt-3">Evidence</span></button>
        <button
          type="button"
          onClick={() => choose('human')}
          aria-pressed={selected === 'human'}
          aria-label="Human verification: a person reviews findings and makes the final decision."
          style={{ animationPlayState }}
          className={`geometry-node absolute right-[13%] top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center border border-copper/60 bg-copper-50 text-[7px] font-mono uppercase leading-tight tracking-wide text-obsidian shadow-sm transition duration-200 hover:scale-110 hover:border-copper hover:shadow-[0_0_16px_rgba(188,116,78,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 active:scale-95 ${selected === 'human' ? 'scale-110 drop-shadow-[0_0_10px_rgba(188,116,78,0.3)]' : ''}`}
        >Human</button>
      </div>

      <p className="mt-2 min-h-8 text-[9px] leading-relaxed text-stone-600" aria-live="polite">
        {selected
          ? <><strong className="text-obsidian">{selected === 'evidence' ? 'Sources' : selected === 'human' ? 'Human' : 'Rules'}:</strong> {detail}</>
          : 'Select RULES, SOURCES, or HUMAN to inspect matched guidance, evidence status, and the active gate policy.'}
      </p>
    </section>
  );
};
