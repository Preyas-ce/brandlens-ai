import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  FileSearch,
  CheckCircle2,
  ShieldCheck,
  History,
  Check,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageProvider';

export interface EagleJourneyMapProps {
  activeStep?: number;
  onSelectStep?: (step: number) => void;
  compact?: boolean;
  className?: string;
  showDescriptions?: boolean;
}

export const EagleJourneyMap: React.FC<EagleJourneyMapProps> = ({
  activeStep = 1,
  onSelectStep,
  compact = false,
  className = '',
  showDescriptions = true,
}) => {
  const { t } = useLanguage();

  const stages = [
    {
      num: 1,
      icon: LayoutDashboard,
      nameKey: 'tourStage1Name' as const,
      descKey: 'tourStage1Desc' as const,
      fallbackName: 'Overview',
      fallbackDesc: 'Get familiar with your workspace and tools.',
    },
    {
      num: 2,
      icon: Sparkles,
      nameKey: 'tourStage2Name' as const,
      descKey: 'tourStage2Desc' as const,
      fallbackName: 'Quick Scan',
      fallbackDesc: 'Run a fast scan and see initial results.',
    },
    {
      num: 3,
      icon: FileSearch,
      nameKey: 'tourStage3Name' as const,
      descKey: 'tourStage3Desc' as const,
      fallbackName: 'Findings',
      fallbackDesc: "Understand what's flagged and why.",
    },
    {
      num: 4,
      icon: CheckCircle2,
      nameKey: 'tourStage4Name' as const,
      descKey: 'tourStage4Desc' as const,
      fallbackName: 'Fix',
      fallbackDesc: 'Make changes and re-analyze.',
    },
    {
      num: 5,
      icon: ShieldCheck,
      nameKey: 'tourStage5Name' as const,
      descKey: 'tourStage5Desc' as const,
      fallbackName: 'Human Verification',
      fallbackDesc: 'Review evidence and make the final decision.',
    },
    {
      num: 6,
      icon: History,
      nameKey: 'tourStage6Name' as const,
      descKey: 'tourStage6Desc' as const,
      fallbackName: 'Audit Trail',
      fallbackDesc: 'Track approvals, activity and history.',
    },
  ];

  return (
    <nav
      aria-label="BrandLens 6-Step Guided Journey"
      className={`w-full select-none ${className}`}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
        {stages.map((stage, idx) => {
          const isCompleted = activeStep > stage.num;
          const isActive = activeStep === stage.num;
          const Icon = stage.icon;
          const name = t(stage.nameKey) || stage.fallbackName;
          const desc = t(stage.descKey) || stage.fallbackDesc;

          return (
            <div
              key={stage.num}
              onClick={() => onSelectStep && onSelectStep(stage.num)}
              className={`relative flex flex-col justify-between p-2.5 sm:p-3 rounded-sm border transition-all duration-200 ${
                onSelectStep ? 'cursor-pointer hover:border-copper/70' : ''
              } ${
                isActive
                  ? 'border-copper bg-copper/5 shadow-[0_0_12px_rgba(188,116,78,0.18)] ring-1 ring-copper/40'
                  : isCompleted
                  ? 'border-forest-700/40 bg-forest/5'
                  : 'border-stone-300 bg-ivory-50/70 opacity-80'
              }`}
            >
              {/* Connector line for large screens */}
              {idx < stages.length - 1 && (
                <div
                  className={`hidden lg:block absolute -right-2 top-5 w-4 h-0.5 z-10 transition-colors ${
                    isCompleted ? 'bg-forest' : 'bg-stone-300'
                  }`}
                  aria-hidden="true"
                />
              )}

              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-mono font-bold transition-colors ${
                    isActive
                      ? 'bg-copper text-ivory ring-2 ring-copper/30'
                      : isCompleted
                      ? 'bg-forest text-ivory'
                      : 'bg-stone-200 text-stone-600 border border-stone-300'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : stage.num}
                </span>

                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive
                      ? 'text-copper'
                      : isCompleted
                      ? 'text-forest'
                      : 'text-stone-400'
                  }`}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h4
                  className={`font-serif text-xs font-semibold leading-tight ${
                    isActive
                      ? 'text-copper-900 font-bold'
                      : isCompleted
                      ? 'text-forest-900'
                      : 'text-stone-700'
                  }`}
                >
                  {name}
                </h4>

                {showDescriptions && !compact && (
                  <p className="mt-1 text-[10px] leading-snug text-stone-600 line-clamp-2">
                    {desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </nav>
  );
};
