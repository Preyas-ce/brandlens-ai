import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { useEagleTour, TourStepNumber } from '@/contexts/EagleTourContext';
import { useLanguage } from '@/contexts/LanguageProvider';
import { EagleJourneyMap } from '@/components/brand/EagleJourneyMap';

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const EagleTourOverlay: React.FC = () => {
  const { isActive, currentStep, nextStep, prevStep, skipStep, stopTour, goToStep } = useEagleTour();
  const { t } = useLanguage();

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const getTargetSelectorForStep = (step: TourStepNumber): string => {
    switch (step) {
      case 1:
        return '[data-tour="overview-metrics"], [data-tour="overview-hero"], section[aria-labelledby="brand-health-heading"]';
      case 2:
        return '[data-tour="quick-scan-modal"], form[class*="space-y"], [data-tour="quick-scan-button"]';
      case 3:
        return '[data-tour="review-findings"], [aria-label="ANALYSIS REPORT"], div[class*="findings"]';
      case 4:
        return '[data-tour="review-suggestion-box"], [data-tour="review-content-editor"], div[class*="SIDE-BY-SIDE"]';
      case 5:
        return '[data-tour="verification-gate"], section[class*="human-verification"], div[class*="border-copper"]';
      case 6:
        return '[data-tour="audit-ledger"], table, div[class*="divide-y"]';
      default:
        return '';
    }
  };

  const updateTargetRect = useCallback(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }

    const selector = getTargetSelectorForStep(currentStep);
    if (!selector) {
      setTargetRect(null);
      return;
    }

    const el = document.querySelector(selector);
    if (el) {
      const b = el.getBoundingClientRect();
      setTargetRect({
        x: Math.max(0, b.left),
        y: Math.max(0, b.top),
        width: b.width,
        height: b.height,
      });
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    updateTargetRect();
    const interval = window.setInterval(updateTargetRect, 250);
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  // Smoothly scroll the highlighted section into viewport on step change
  useEffect(() => {
    if (!isActive) return;
    const selector = getTargetSelectorForStep(currentStep);
    if (!selector) return;

    const scrollTimer = window.setTimeout(() => {
      const el = document.querySelector(selector);
      if (el) {
        const prefersReducedMotion = typeof window !== 'undefined'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const rect = el.getBoundingClientRect();
        const isInComfortableView = (
          rect.top >= 70 &&
          rect.bottom <= (window.innerHeight - 70)
        );

        if (!isInComfortableView) {
          el.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
          });
        }
        updateTargetRect();
      }
    }, 120);

    return () => window.clearTimeout(scrollTimer);
  }, [isActive, currentStep, updateTargetRect]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopTour(false);
      } else if (e.key === 'ArrowRight' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase() || '')) {
        nextStep();
      } else if (e.key === 'ArrowLeft' && !['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase() || '')) {
        prevStep();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, nextStep, prevStep, stopTour]);

  if (!isActive) return null;

  const stepTitles: Record<TourStepNumber, string> = {
    1: t('tourStep1Title') || 'Step 1: Overview · Your Editorial Command Center',
    2: t('tourStep2Title') || 'Step 2: Quick Scan · Pre-Flight Heuristic Checks',
    3: t('tourStep3Title') || 'Step 3: Findings · Evidence & Policy Detection',
    4: t('tourStep4Title') || 'Step 4: Fix · Editorial Suggestions & Re-analysis',
    5: t('tourStep5Title') || 'Step 5: Human Verification Gate · Final Editorial Authority',
    6: t('tourStep6Title') || 'Step 6: Audit Trail · Immutable Governance Ledger',
  };

  const eagleDialogs: Record<TourStepNumber, string> = {
    1: t('tourStep1EagleDialog') || "I'm your BrandLens guide! I'll walk you through the key features in just a few minutes.",
    2: t('tourStep2EagleDialog') || "Let's try a quick scan. This shows potential issues based on our local rule engine in seconds.",
    3: t('tourStep3EagleDialog') || "Here are the findings. Each one shows the exact matched text, severity, rule citation, and why it was flagged.",
    4: t('tourStep4EagleDialog') || "You can apply suggested rewrites or make your own changes. Re-analyzing shows the updated result immediately.",
    5: t('tourStep5EagleDialog') || "This is the heart of BrandLens. Automated checks find potential issues, but only human editors verify facts and make the final call.",
    6: t('tourStep6EagleDialog') || "Finally, check the audit trail. It logs every submission, rewrite, evidence attachment, and human approval decision.",
  };

  const stepBodies: Record<TourStepNumber, string> = {
    1: t('tourStep1Body') || 'The Overview dashboard gives you real-time visibility into content health, active reviews, and preliminary risk signals. Use the language switcher at the top right to toggle between English, Hindi, and Gujarati at any moment.',
    2: t('tourStep2Body') || 'Quick Scan performs in-memory inspection against your active brand guidelines without persisting review records. Clean content means no rule violations matched under tested checks—it does not independently certify external truth.',
    3: t('tourStep3Body') || 'When copy is submitted, the deterministic analysis engine highlights unverified claims, prohibited terms, and voice inconsistencies with full explainability. Every flag links directly to your approved guidelines.',
    4: t('tourStep4Body') || 'BrandLens provides safe editorial rewrites for flagged phrases. Applying suggestions updates the draft while preserving revision history. When you re-analyze, the engine recalculates consistency without overwriting previous versions.',
    5: t('tourStep5Body') || 'AI never autonomously publishes or finalizes content. Credentialed human reviewers inspect findings, review attached private evidence documents, and record an explicit decision: Approve, Request Changes, or Reject.',
    6: t('tourStep6Body') || 'Every action across the editorial lifecycle produces a verifiable audit record. Complete traceability gives legal, brand, and editorial leadership permanent confidence in publication integrity.',
  };

  const isLastStep = currentStep === 6;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BrandLens Eagle Interactive Guided Tour"
      className="fixed inset-0 z-[80] pointer-events-auto select-none"
    >
      {/* SVG Mask Spotlight Overlay */}
      {targetRect ? (
        <svg
          className="fixed inset-0 pointer-events-none z-[81] w-full h-full transition-all duration-300"
          aria-hidden="true"
        >
          <defs>
            <mask id="eagle-tour-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.x - 6}
                y={targetRect.y - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="6"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(23, 25, 22, 0.72)"
            mask="url(#eagle-tour-spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 bg-obsidian/70 backdrop-blur-[1px] z-[81] pointer-events-none" />
      )}

      {/* Target Focus Border & Glow */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[82] border-2 border-copper rounded-md shadow-[0_0_18px_rgba(188,116,78,0.45)] transition-all duration-300"
          style={{
            left: targetRect.x - 6,
            top: targetRect.y - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
          aria-hidden="true"
        />
      )}

      {/* Tutorial Card Container */}
      <div className="fixed inset-x-3 bottom-3 sm:bottom-6 sm:inset-x-auto sm:right-8 sm:w-[32rem] lg:w-[36rem] z-[85] max-h-[92vh] overflow-y-auto">
        <div
          ref={cardRef}
          className="border border-stone-300 bg-[#FAF7F2] text-obsidian p-4 sm:p-5 shadow-[0_20px_45px_rgba(23,25,22,0.24)] rounded-sm ring-1 ring-black/5"
        >
          {/* Card Header: Mascot Avatar, Guide Badge, Step Indicator & Close Button */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-3.5">
            <div className="flex items-center gap-3">
              {/* BrandLens Eagle Mascot Avatar */}
              <div className="relative h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-full border-2 border-copper overflow-hidden shadow-sm bg-obsidian">
                <img
                  src="/mascot-eagle.jpg"
                  alt="BrandLens Eagle Mascot"
                  className="h-full w-full object-cover object-top"
                />
                <span
                  className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-forest border-2 border-ivory"
                  title="Guide active"
                  aria-hidden="true"
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-sm font-bold tracking-tight text-obsidian">
                    {t('tourBadgeGuide') || 'BrandLens Guide'}
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-xs bg-copper/15 text-copper-800 font-semibold">
                    {t('tourStepOf')?.replace('{current}', String(currentStep)).replace('{total}', '6') || `Step ${currentStep} of 6`}
                  </span>
                </div>

                {/* 6-Step Connected Progress Dots */}
                <div className="flex items-center gap-1.5 mt-1.5" aria-hidden="true">
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => goToStep(s)}
                      className={`h-1.5 rounded-full transition-all ${
                        currentStep === s
                          ? 'w-6 bg-copper'
                          : s < currentStep
                          ? 'w-2 bg-forest'
                          : 'w-2 bg-stone-300'
                      }`}
                      title={`Go to step ${s}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Skip Tutorial Button */}
            <button
              type="button"
              onClick={() => stopTour(false)}
              className="p-1.5 rounded-xs text-stone-500 hover:text-obsidian hover:bg-stone-200/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper"
              title={t('tourSkipTutorial') || 'Skip Tutorial'}
              aria-label={t('tourSkipTutorial') || 'Skip Tutorial'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Card Body: Step Title, Eagle Speech Bubble & Content */}
          <div className="space-y-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-copper block">
                STAGE 0{currentStep} / 06
              </span>
              <h3 className="font-serif text-base sm:text-lg font-semibold text-obsidian tracking-tight leading-snug mt-0.5">
                {stepTitles[currentStep]}
              </h3>
            </div>

            {/* Mascot Speech Bubble with Tail */}
            <div className="relative rounded-sm border border-copper/30 bg-copper/5 p-3 text-xs leading-relaxed text-obsidian">
              <p className="font-medium text-copper-950 italic">
                “{eagleDialogs[currentStep]}”
              </p>
            </div>

            <p className="text-xs text-stone-700 leading-relaxed font-sans">
              {stepBodies[currentStep]}
            </p>

            {/* Step 1 Extra: Full 6-Stage Journey Map Preview */}
            {currentStep === 1 && (
              <div className="mt-3 pt-3 border-t border-stone-200">
                <span className="text-[9px] font-mono uppercase tracking-[0.14em] text-stone-500 block mb-2">
                  {t('tourConnectedJourney') || 'The BrandLens Journey · 6 Simple Steps'}
                </span>
                <EagleJourneyMap activeStep={currentStep} onSelectStep={goToStep} compact={true} />
              </div>
            )}

            {/* Step 5 Extra: Central Philosophy Callout */}
            {currentStep === 5 && (
              <div className="rounded-sm border-l-4 border-forest bg-forest/10 p-2.5 text-xs text-forest-950 font-medium">
                <div className="flex items-center gap-1.5 font-semibold text-forest-900 mb-0.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-forest" />
                  <span>{t('humanGateActive') || 'Core Philosophy'}</span>
                </div>
                <p className="italic text-[11px] leading-snug">
                  {t('tourStep5Philosophy') || '“AI and humans do not compete. They work together—automated detection supports human judgment.”'}
                </p>
              </div>
            )}

            {/* Step 6 Extra: Completion Message & Recap */}
            {currentStep === 6 && (
              <div className="rounded-sm border border-forest/30 bg-forest/5 p-3 text-xs">
                <div className="flex items-center gap-2 text-forest-800 font-serif font-bold text-sm mb-1">
                  <CheckCircle className="h-4 w-4 text-forest" />
                  <span>{t('tourStep6CompletionHeadline') || 'Explore. Learn. Create better content.'}</span>
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed">
                  {t('tourStep6CompletionBody') || 'You are now ready to explore BrandLens AI on your own. You can review drafts, configure guidelines, attach supporting evidence, or replay this tour anytime from the Overview.'}
                </p>
              </div>
            )}
          </div>

          {/* Card Footer: Navigation & Skip Actions */}
          <div className="mt-4 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Skip This Step */}
            {!isLastStep ? (
              <button
                type="button"
                onClick={skipStep}
                className="text-[11px] font-mono uppercase tracking-wider text-stone-500 hover:text-obsidian transition-colors underline decoration-stone-300 underline-offset-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-copper"
              >
                {t('tourSkipStep') || 'Skip This Step'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => stopTour(false)}
                className="text-[11px] font-mono uppercase tracking-wider text-stone-500 hover:text-obsidian transition-colors underline decoration-stone-300 underline-offset-2"
              >
                {t('tourSkipTutorial') || 'Skip Tutorial'}
              </button>
            )}

            <div className="flex items-center gap-2">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xs border border-stone-300 bg-ivory text-stone-700 text-xs font-medium hover:bg-stone-200/50 hover:text-obsidian transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>{t('tourBack') || 'Back'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={nextStep}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xs text-xs font-semibold text-ivory transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  isLastStep
                    ? 'bg-forest hover:bg-forest-700 focus-visible:ring-forest'
                    : 'bg-copper hover:bg-copper-600 focus-visible:ring-copper'
                }`}
              >
                <span>
                  {isLastStep
                    ? t('tourFinish') || 'Finish Tour & Explore'
                    : t('tourNext') || 'Next'}
                </span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
