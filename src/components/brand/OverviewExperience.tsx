import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpenCheck, Check, FileSearch, LockKeyhole, ScanEye, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const RISK_CLUSTERS = [
  { x: 18, y: 32, rule: 'R-103', label: 'Unverified “100% ROI” claim', content: 'We guarantee 100% ROI for every customer.' },
  { x: 41, y: 70, rule: 'R-106', label: 'Low-contrast CTA flagged', content: 'Click here to learn more about our service.' },
  { x: 64, y: 26, rule: 'EVI-01', label: 'Source verified', content: 'A cited benchmark is available for this outcome.' },
  { x: 79, y: 62, rule: 'R-101', label: 'Unsupported superlative', content: 'We are the best platform in the world.' },
  { x: 91, y: 35, rule: 'R-108', label: 'Dismissive voice detected', content: 'Ignore competitors!!' },
];
const RISK_CELLS = new Set(
  RISK_CLUSTERS.flatMap((cluster) => {
    const col = Math.floor((cluster.x / 100) * 60);
    const row = Math.floor((cluster.y / 100) * 24);
    return [row * 60 + col, row * 60 + col - 1, row * 60 + col + 1, (row - 1) * 60 + col, (row + 1) * 60 + col];
  }),
);

export const RiskSpotlight: React.FC<{ onTest: (content: string) => void; paused?: boolean }> = ({ onTest, paused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);
  const calloutHovered = useRef(false);
  const [activeCluster, setActiveCluster] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !wrapper || !context) return;
    const cols = 60;
    const rows = 24;
    let pixelRatio = 1;
    const resizeCanvas = () => {
      const bounds = wrapper.getBoundingClientRect();
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);
      canvas.style.width = `${bounds.width}px`;
      canvas.style.height = `${bounds.height}px`;
    };
    const draw = () => {
      const bounds = wrapper.getBoundingClientRect();
      const width = bounds.width;
      const height = bounds.height;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      const cellWidth = width / cols;
      const cellHeight = height / rows;
      const spotlight = cursor.current;
      if (spotlight && !paused && !reducedMotion) {
        const glow = context.createRadialGradient(spotlight.x, spotlight.y, 4, spotlight.x, spotlight.y, Math.min(width, height) * 0.3);
        glow.addColorStop(0, 'rgba(200,100,50,0.15)');
        glow.addColorStop(0.55, 'rgba(30,58,47,0.18)');
        glow.addColorStop(1, 'rgba(18,20,19,0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, width, height);
      }
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * cellWidth;
          const y = row * cellHeight;
          const distance = spotlight && !paused && !reducedMotion
            ? Math.hypot(spotlight.x - (x + cellWidth / 2), spotlight.y - (y + cellHeight / 2))
            : Number.POSITIVE_INFINITY;
          const intensity = Math.max(0, 1 - distance / (Math.min(width, height) * 0.24));
          const risk = RISK_CELLS.has(row * cols + col);
          context.fillStyle = risk
            ? 'rgba(200,100,50,0.68)'
            : `rgba(${intensity > 0.2 ? '30,58,47' : '246,241,232'},${0.045 + intensity * 0.22})`;
          context.fillRect(x + 1, y + 1, Math.max(1, cellWidth - 2), Math.max(1, cellHeight - 2));
          if (intensity > 0.38 || risk) {
            context.strokeStyle = risk ? 'rgba(232,177,126,0.72)' : `rgba(126,178,152,${intensity * 0.4})`;
            context.strokeRect(x + 1.5, y + 1.5, Math.max(1, cellWidth - 3), Math.max(1, cellHeight - 3));
          }
        }
      }
    };
    const animate = () => {
      draw();
      frame.current = window.requestAnimationFrame(animate);
    };
    const pointerMove = (event: PointerEvent) => {
      const bounds = wrapper.getBoundingClientRect();
      cursor.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      if (calloutHovered.current) {
        if (paused || reducedMotion) draw();
        return;
      }
      const x = (cursor.current.x / bounds.width) * 100;
      const y = (cursor.current.y / bounds.height) * 100;
      const hit = RISK_CLUSTERS.findIndex((cluster) => Math.hypot((x - cluster.x) * bounds.width / 100, (y - cluster.y) * bounds.height / 100) < 76);
      setActiveCluster(hit >= 0 ? hit : null);
      if (paused || reducedMotion) draw();
    };
    const pointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget instanceof Node && wrapper.contains(event.relatedTarget)) return;
      cursor.current = null;
      calloutHovered.current = false;
      setActiveCluster(null);
      if (paused || reducedMotion) draw();
    };
    resizeCanvas();
    draw();
    if (!paused && !reducedMotion) frame.current = window.requestAnimationFrame(animate);
    wrapper.addEventListener('pointermove', pointerMove, { passive: true });
    wrapper.addEventListener('pointerleave', pointerLeave);
    const onResize = () => {
      resizeCanvas();
      draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(frame.current);
      wrapper.removeEventListener('pointermove', pointerMove);
      wrapper.removeEventListener('pointerleave', pointerLeave);
      window.removeEventListener('resize', onResize);
    };
  }, [paused, reducedMotion]);

  return (
    <section aria-labelledby="risk-spotlight-heading" className="relative isolate overflow-hidden border-y border-stone-700 bg-[#121413] px-5 py-10 text-ivory sm:px-8 lg:px-12">
      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper-300">02 / Risk spotlight · Local rule signals</p>
            <h2 id="risk-spotlight-heading" className="mt-2 max-w-3xl font-serif text-3xl font-normal leading-tight text-ivory sm:text-4xl">Make invisible brand drift impossible to miss.</h2>
          </div>
          <p className="max-w-sm text-[10px] leading-relaxed text-stone-300">Sweep across the content field to reveal the claims and voice signals that deserve a closer human look.</p>
        </div>
        <div ref={wrapperRef} className="relative h-52 overflow-hidden border border-stone-700/80 bg-[#171a18]/85 sm:h-64" aria-label="Interactive 60 by 24 pixel risk field">
          <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" />
          {RISK_CLUSTERS.map((cluster, index) => (
            <div key={cluster.rule} className="absolute z-10" style={{ left: `${cluster.x}%`, top: `${cluster.y}%` }}>
              <button
                type="button"
                aria-label={`Inspect ${cluster.rule}: ${cluster.label}`}
                onClick={() => onTest(cluster.content)}
                onFocus={() => setActiveCluster(index)}
                onBlur={() => setActiveCluster(null)}
                className={`absolute -left-3 -top-3 grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ivory ${cluster.rule.startsWith('EVI') ? 'text-forest-300' : 'text-copper-300'}`}
              >
                <span className={`block h-2 w-2 rounded-full ${cluster.rule.startsWith('EVI') ? 'bg-forest-300 shadow-[0_0_12px_rgba(126,178,152,0.8)]' : 'bg-copper-300 shadow-[0_0_12px_rgba(200,100,50,0.9)]'}`} />
              </button>
              {activeCluster === index && (
                <button
                  type="button"
                  onClick={() => onTest(cluster.content)}
                  onPointerEnter={() => setActiveCluster(index)}
                  onMouseEnter={() => { calloutHovered.current = true; }}
                  onMouseLeave={() => { calloutHovered.current = false; }}
                  className={`absolute top-2 z-20 w-56 max-w-[calc(100vw-4rem)] border border-copper-300/60 bg-[#121413]/95 px-3 py-2 text-left shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition hover:border-copper-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-300 ${cluster.x > 42 ? 'right-2' : 'left-2'}`}
                >
                  <span className={`block text-[8px] font-mono font-bold uppercase tracking-wider ${cluster.rule.startsWith('EVI') ? 'text-forest-300' : 'text-copper-200'}`}>{cluster.rule.startsWith('EVI') ? '✓' : '▲'} {cluster.rule}: {cluster.label}</span>
                  <span className="mt-1 block text-[8px] font-mono uppercase tracking-wider text-stone-300">Click to test in Workbench ↗</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[8px] font-mono uppercase tracking-[0.14em] text-stone-400">
          <span>60 columns / 24 rows · deterministic demo signals</span>
          <span>{activeCluster === null ? 'Move pointer to illuminate a risk cluster' : 'Risk cluster acquired · Activate callout to inspect'}</span>
        </div>
      </div>
    </section>
  );
};

const SHOWCASE_STEPS = [
  { title: 'Configure Rules', descriptor: 'Lock approved voice, claims, and visual tokens.', metric: '09 active rules', icon: BookOpenCheck, tag: 'Rulebook · R-101—109', body: 'Keep voice, terminology, claims, and accessibility guidance explicit. Every finding points back to a local rule.', action: '/guidelines' },
  { title: 'Ingest Drafts', descriptor: 'Scan social copy, campaign briefs, and launch assets.', metric: '3 content types', icon: FileSearch, tag: 'Workbench · local scan', body: 'Bring copy into a deterministic local scan. The submitted draft remains intact until its creator chooses an edit.', action: '/review' },
  { title: 'Ground Evidence', descriptor: 'Separate contradicted claims from unverified gaps.', metric: 'Evidence-aware', icon: ScanEye, tag: 'Sources · verified or unverified', body: 'Missing catalogue evidence is labeled Unverified—not false—so reviewers can make a grounded decision.', action: '/guidelines?tab=evidence' },
  { title: 'Preserve Intent', descriptor: 'Apply context-aware rewrites without losing the creator’s voice.', metric: 'Creator controlled', icon: Waves, tag: 'Editorial rewrite · optional', body: 'Suggested language is a starting point. Creators choose whether to apply, refine, or reject a rewrite.', action: '/review' },
  { title: 'Human Trust Gate', descriptor: 'Enforce mandatory reviewer sign-off before publication.', metric: 'Human-owned', icon: ShieldCheck, tag: 'Gate · always required', body: 'Scores advise; a named reviewer owns the final approval, revision request, or rejection.', action: '/approvals' },
  { title: 'Audit Ledger', descriptor: 'Bind every approval to an immutable revision hash.', metric: 'Revision-bound', icon: LockKeyhole, tag: 'Ledger · content hash', body: 'Retain lifecycle timestamps and decisions against the exact reviewed revision, so approvals never transfer to new content.', action: '/history' },
];

export const SystemShowcase: React.FC<{ onNavigate: (path: string) => void; paused?: boolean }> = ({ onNavigate, paused = false }) => {
  const [active, setActive] = useState(0);
  const reducedMotion = useReducedMotion();
  const step = SHOWCASE_STEPS[active];
  const Icon = step.icon;
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % SHOWCASE_STEPS.length), 7000);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);
  return (
    <section aria-labelledby="system-showcase-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">03 / One connected system</p>
          <h2 id="system-showcase-heading" className="mt-1 font-serif text-3xl font-normal text-obsidian">One connected system. Six clear moves.</h2>
        </div>
        <span className="text-[8px] font-mono uppercase tracking-wider text-stone-500">{paused || reducedMotion ? 'Motion paused' : 'Auto-guided · Select a step'}</span>
      </div>
      <div role="tablist" aria-label="Governance workflow stages" className="flex gap-2 overflow-x-auto pb-1">
        {SHOWCASE_STEPS.map((item, index) => (
          <button key={item.title} id={`showcase-tab-${index}`} type="button" role="tab" aria-selected={active === index} aria-controls="showcase-panel" onClick={() => setActive(index)} className={`shrink-0 rounded-full border px-3 py-2 text-[8px] font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${active === index ? 'border-obsidian bg-obsidian text-ivory' : 'border-stone-300 bg-ivory-50 text-stone-600 hover:border-copper'}`}>
            {String(index + 1).padStart(2, '0')} {item.title}
          </button>
        ))}
      </div>
      <div id="showcase-panel" role="tabpanel" aria-labelledby={`showcase-tab-${active}`} className="grid min-h-[17rem] gap-6 border border-stone-300 bg-ivory-50/70 p-5 sm:p-7 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col justify-between gap-5">
          <div>
            <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-copper">Move {String(active + 1).padStart(2, '0')} / 06</span>
            <h3 className="mt-2 font-serif text-3xl text-obsidian">{step.title}</h3>
            <p className="mt-2 text-sm text-stone-600">{step.descriptor}</p>
            <p className="mt-4 max-w-lg text-xs leading-relaxed text-stone-700">{step.body}</p>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-stone-200 pt-3">
            <span className="font-serif text-2xl text-forest">{step.metric}</span>
            <button type="button" onClick={() => onNavigate(step.action)} className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-copper-800 hover:text-obsidian focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60">Explore this stage <ArrowRight className="h-3 w-3" /></button>
          </div>
        </div>
        <div className="group relative flex min-h-48 flex-col justify-between overflow-hidden border border-stone-300 bg-[#171916] p-5 text-ivory transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(23,25,22,0.2)]">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-copper/10 blur-3xl transition-opacity group-hover:opacity-100" aria-hidden="true" />
          <div className="relative flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[8px] font-mono uppercase tracking-[0.16em] text-stone-300"><Icon className="h-4 w-4 text-copper-200" /> {step.tag}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-forest-300 shadow-[0_0_9px_rgba(126,178,152,0.6)]" />
          </div>
          <div className="relative grid grid-cols-2 gap-2">
            {[
              ['Score', '98/100'],
              ['Findings', '4 resolved'],
              ['Revision', '#fnv1a'],
              ['Authority', 'Human gate'],
            ].map(([label, value]) => (
              <div key={label} className="border border-stone-700 bg-obsidian-900/70 p-3 transition-transform group-hover:translate-y-[-2px]">
                <span className="block text-[7px] font-mono uppercase tracking-wider text-stone-400">{label}</span>
                <span className="mt-1 block text-xs font-semibold text-ivory">{value}</span>
              </div>
            ))}
          </div>
          <span className="relative mt-3 text-[8px] font-mono uppercase tracking-widest text-stone-400">Local interface preview · illustrative telemetry</span>
        </div>
      </div>
    </section>
  );
};

const PILLARS = [
  { title: 'See Every Claim', detail: 'Surface consequential language in context.', icon: ScanEye },
  { title: 'Distinguish Unverified', detail: 'Separate missing evidence from falsehood.', icon: BookOpenCheck },
  { title: 'Cut Through Jargon', detail: 'Prefer language people can understand.', icon: Waves },
  { title: 'Act With Guardrails', detail: 'Keep a human in control of publication.', icon: ShieldCheck },
  { title: 'Trace Every Decision', detail: 'Bind decisions to a reviewed revision.', icon: LockKeyhole },
];

export const GovernanceDeck: React.FC = () => {
  const [active, setActive] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  return (
    <section aria-labelledby="governance-deck-heading" className="overflow-hidden border-y border-stone-700 bg-[#121413] px-5 py-10 text-ivory sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper-300">04 / Governance pillars</p>
            <h2 id="governance-deck-heading" className="mt-2 font-serif text-3xl text-ivory">Built to make governance feel clear.</h2>
          </div>
          <p className="text-[9px] font-mono uppercase tracking-wider text-stone-400">Hover or focus a card to bring it forward</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PILLARS.map((pillar, index) => {
            const Icon = pillar.icon;
            const isActive = active === index;
            return (
              <button
                key={pillar.title}
                type="button"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(isActive ? null : index)}
                className={`group relative flex min-h-48 flex-col justify-between border p-4 text-left transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper-300 ${isActive ? 'z-10 -translate-y-2 scale-[1.025] border-copper-300 bg-forest-900 shadow-[0_16px_38px_rgba(0,0,0,0.4)]' : 'border-stone-700 bg-[#1b1e1c] hover:border-forest-300'} ${reducedMotion ? '!transform-none !transition-none' : ''}`}
                style={{ transform: !reducedMotion && active !== null && !isActive ? `translateY(${Math.abs(active - index) === 1 ? 4 : 0}px) rotateY(${(index - active) * 1.5}deg)` : undefined }}
              >
                <span className={`grid h-10 w-10 place-items-center border ${isActive ? 'border-copper-300/70 bg-copper-400/15 text-copper-100' : 'border-stone-600 text-stone-300'} transition-colors`}>
                  <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                </span>
                <span>
                  <span className="block text-[8px] font-mono uppercase tracking-widest text-stone-400">0{index + 1} / Principle</span>
                  <span className="mt-2 block font-serif text-lg leading-tight text-ivory">{pillar.title}</span>
                  <span className="mt-2 block text-[10px] leading-relaxed text-stone-300">{pillar.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const VALUE_PROPOSITIONS = [
  'verify every claim',
  'ground AI drafts in evidence',
  'protect your brand voice',
  'enforce human sign-off',
  'audit every revision',
];

export const KineticCallToAction: React.FC<{ onLaunch: () => void; onQuickScan: () => void; paused?: boolean }> = ({ onLaunch, onQuickScan, paused = false }) => {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (paused || reducedMotion) return;
    const currentPhrase = VALUE_PROPOSITIONS[phraseIndex];
    const complete = visibleCount >= currentPhrase.length;
    const timer = window.setTimeout(() => {
      if (!deleting && !complete) setVisibleCount((count) => count + 1);
      else if (!deleting && complete) setDeleting(true);
      else if (deleting && visibleCount > 0) setVisibleCount((count) => count - 1);
      else {
        setPhraseIndex((index) => (index + 1) % VALUE_PROPOSITIONS.length);
        setDeleting(false);
      }
    }, !deleting && complete ? 1300 : deleting ? 38 : 68);
    return () => window.clearTimeout(timer);
  }, [phraseIndex, visibleCount, deleting, paused, reducedMotion]);
  const phrase = paused || reducedMotion ? VALUE_PROPOSITIONS[phraseIndex] : VALUE_PROPOSITIONS[phraseIndex].slice(0, visibleCount);
  return (
    <section className="editorial-blueprint overflow-hidden border-y border-stone-300 px-5 py-12 sm:px-8 lg:px-12" aria-labelledby="kinetic-cta-heading">
      <div className="mx-auto max-w-7xl">
        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">05 / Less noise. More trust.</p>
        <h2 id="kinetic-cta-heading" className="mt-4 max-w-5xl font-serif text-4xl font-normal leading-[1.04] tracking-tight text-obsidian sm:text-6xl lg:text-7xl">
          A smarter way to
          <span className="my-2 block min-h-[1.1em] font-sans text-forest-800">
            <span className="mr-2 text-copper" aria-hidden="true">[</span>
            <span aria-live="polite">{phrase}<span className="kinetic-cursor ml-1 inline-block h-[0.78em] w-[0.11em] translate-y-[0.08em] bg-copper align-baseline" aria-hidden="true" /></span>
            <span className="ml-2 text-copper" aria-hidden="true">]</span>
          </span>
          before it goes live.
        </h2>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={onLaunch} className="inline-flex items-center gap-2 border border-obsidian bg-obsidian px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-ivory transition hover:-translate-y-0.5 hover:bg-forest-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/70">
            Launch Content Workbench <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onQuickScan} className="inline-flex items-center gap-2 border border-stone-400 bg-ivory-50/80 px-4 py-3 text-[10px] font-mono uppercase tracking-wider text-obsidian transition hover:border-copper hover:text-copper-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/70">
            <Sparkles className="h-3.5 w-3.5" /> Run Quick Heuristic Scan
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-[9px] text-stone-500"><Check className="h-3 w-3 text-forest" /> Local engine · human-authorized decisions</span>
        </div>
      </div>
    </section>
  );
};
