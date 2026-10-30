import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Compass, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageProvider';
import { EAGLE_TOUR_TRIGGER_EVENT } from '@/services/uiPreferences';

interface SidebarDemoStudioProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export const SidebarDemoStudio: React.FC<SidebarDemoStudioProps> = ({
  collapsed,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [lastTourTrigger, setLastTourTrigger] = useState(0);

  const handleLaunchClean = () => {
    navigate('/review?scenario=clean-approval&reanalyze=1');
    onNavigate?.();
  };

  const handleLaunchFix = () => {
    navigate('/review?scenario=needs-review&reanalyze=1');
    onNavigate?.();
  };

  const handleReplayTour = () => {
    const now = Date.now();
    if (now - lastTourTrigger < 800) return;
    setLastTourTrigger(now);
    window.dispatchEvent(new CustomEvent(EAGLE_TOUR_TRIGGER_EVENT, { detail: { step: 1 } }));
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-2 px-1 border-t border-obsidian-800" title={t('demoStudioTitle') || 'Demo Studio'}>
        <button
          type="button"
          onClick={handleLaunchFix}
          aria-label={t('demoStudioFixTitle') || 'Try Demo Review'}
          className="p-2 rounded-[2px] text-copper-300 hover:text-ivory hover:bg-obsidian-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-3 rounded-[3px] border border-obsidian-700/80 bg-obsidian-900/90 p-3 shadow-xs space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-obsidian-800 pb-2">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-copper" />
          <span className="font-serif text-xs font-medium text-ivory">
            {t('demoStudioTitle') || 'Demo Studio'}
          </span>
        </div>
        <span className="text-[8.5px] font-mono uppercase tracking-[0.16em] text-copper-400 font-semibold px-1 py-0.5 rounded-xs bg-copper/15">
          {t('demoStudioTag') || 'TRY A REVIEW'}
        </span>
      </div>

      {/* Action 1: Clean Review */}
      <button
        type="button"
        onClick={handleLaunchClean}
        className="w-full text-left p-2 rounded-xs border border-obsidian-800 bg-obsidian-800/60 hover:bg-obsidian-800 hover:border-forest/40 transition-all duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-forest-300 shrink-0 group-hover:scale-105 transition-transform" />
          <span className="text-xs font-serif font-medium text-ivory group-hover:text-forest-200">
            {t('demoStudioCleanTitle') || 'Clean Review'}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-stone-400 leading-snug pl-5.5">
          {t('demoStudioCleanDesc') || 'See a review with no matched issues.'}
        </p>
      </button>

      {/* Action 2: Find and Fix Issues */}
      <button
        type="button"
        onClick={handleLaunchFix}
        className="w-full text-left p-2 rounded-xs border border-obsidian-800 bg-obsidian-800/60 hover:bg-obsidian-800 hover:border-copper/40 transition-all duration-150 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-copper shrink-0 group-hover:scale-105 transition-transform" />
          <span className="text-xs font-serif font-medium text-ivory group-hover:text-copper-200">
            {t('demoStudioFixTitle') || 'Find and Fix Issues'}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-stone-400 leading-snug pl-5.5">
          {t('demoStudioFixDesc') || 'Explore flagged content, rules & rewrites.'}
        </p>
      </button>

      {/* Action 3: Replay Eagle Tour */}
      <button
        type="button"
        onClick={handleReplayTour}
        className="w-full text-left p-1.5 rounded-xs text-[10px] font-mono uppercase tracking-wider text-stone-400 hover:text-ivory hover:bg-obsidian-800 transition-colors flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-copper" />
          {t('demoStudioTourTitle') || 'Replay Eagle Tour'}
        </span>
        <span className="text-[9px] text-stone-500">1–6 →</span>
      </button>

      {/* Editorial philosophical reminder */}
      <div className="pt-1.5 border-t border-obsidian-800/80 text-center">
        <span className="text-[9px] font-serif italic text-stone-400">
          “{t('demoStudioPhilosophy') || 'Unverified does not mean false.'}”
        </span>
      </div>
    </div>
  );
};
