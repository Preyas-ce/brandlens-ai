import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DEMO_SCENARIOS, prepareDemoScenarios } from '@/services/demoScenarios';
import { ReviewRecord } from '@/types/review';
import { useLanguage, type TranslationKey } from '@/contexts/LanguageProvider';

interface DemoScenariosGalleryProps {
  records: ReviewRecord[];
  onScenariosPrepared?: () => void;
}

interface ScenarioCardConfig {
  id: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  focusKey: TranslationKey;
  badgeVariant: 'copper' | 'neutral' | 'forest';
  badgeLabel: string;
  icon: React.ReactNode;
}

const SCENARIO_CONFIGS: ScenarioCardConfig[] = [
  {
    id: 'needs-review',
    titleKey: 'demoScenarioNeedsReviewTitle',
    descKey: 'demoScenarioNeedsReviewDesc',
    focusKey: 'demoScenarioNeedsReviewFocus',
    badgeVariant: 'copper',
    badgeLabel: 'Critical Drift · 3 Issues',
    icon: <ShieldAlert className="h-4 w-4 text-copper" />,
  },
  {
    id: 'evidence-review',
    titleKey: 'demoScenarioEvidenceTitle',
    descKey: 'demoScenarioEvidenceDesc',
    focusKey: 'demoScenarioEvidenceFocus',
    badgeVariant: 'neutral',
    badgeLabel: 'Evidence Gap · Citation',
    icon: <BookOpenCheck className="h-4 w-4 text-stone-600" />,
  },
  {
    id: 'clean-approval',
    titleKey: 'demoScenarioCleanTitle',
    descKey: 'demoScenarioCleanDesc',
    focusKey: 'demoScenarioCleanFocus',
    badgeVariant: 'forest',
    badgeLabel: 'Clean Pass · Ready for Gate',
    icon: <CheckCircle2 className="h-4 w-4 text-forest" />,
  },
];

export const DemoScenariosGallery: React.FC<DemoScenariosGalleryProps> = ({
  records,
  onScenariosPrepared,
}) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [prepNotice, setPrepNotice] = useState('');

  const existingScenarioMap = new Map<string, ReviewRecord>();
  records.forEach((record) => {
    if (record.demoScenarioId) {
      existingScenarioMap.set(record.demoScenarioId, record);
    }
  });

  const handlePrepareAll = () => {
    prepareDemoScenarios();
    setPrepNotice(t('demoPrepareAllSuccess'));
    if (onScenariosPrepared) {
      onScenariosPrepared();
    }
  };

  const handleInspectInGate = (scenarioId: string) => {
    const existing = existingScenarioMap.get(scenarioId);
    if (existing) {
      navigate(`/approvals/${encodeURIComponent(existing.id)}`);
      return;
    }
    // Prepare scenarios first, then locate the record
    prepareDemoScenarios();
    if (onScenariosPrepared) onScenariosPrepared();
    // Navigate to approvals queue where all prepared reviews reside
    navigate('/approvals');
  };

  const handleTestInWorkbench = (scenarioId: string) => {
    navigate(`/review?scenario=${encodeURIComponent(scenarioId)}`);
  };

  return (
    <section
      id="demo-scenarios-gallery"
      aria-labelledby="demo-gallery-heading"
      className="border-y border-stone-300 bg-ivory-100/60 px-5 py-8 sm:px-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-copper" aria-hidden="true" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
              {t('demoGalleryKicker')}
            </p>
          </div>
          <h3 id="demo-gallery-heading" className="mt-1 font-serif text-2xl font-normal text-obsidian sm:text-3xl">
            {t('demoGalleryTitle')}
          </h3>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-stone-600 sm:text-sm">
            {t('demoGallerySubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrepareAll}
            leftIcon={<Sparkles className="h-3.5 w-3.5 text-copper" />}
          >
            {t('dashboardPrepareDemoRecords')}
          </Button>
        </div>
      </div>

      {prepNotice && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2 border-l-2 border-forest bg-forest-50 px-4 py-2.5 text-xs text-forest-800"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-forest" />
          <span>{prepNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {SCENARIO_CONFIGS.map((config) => {
          const scenario = DEMO_SCENARIOS.find((s) => s.id === config.id);

          return (
            <div
              key={config.id}
              className="flex flex-col justify-between border border-stone-300/80 bg-ivory-50 p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-copper/70 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-stone-700">
                    {config.icon}
                    <span className="font-mono text-[10px] uppercase tracking-wider text-stone-500">
                      {scenario?.contentType || 'Copy'}
                    </span>
                  </span>
                  <Badge variant={config.badgeVariant} size="sm">
                    {config.badgeLabel}
                  </Badge>
                </div>

                <h4 className="mt-3.5 font-serif text-lg font-medium text-obsidian">
                  {t(config.titleKey)}
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  {t(config.descKey)}
                </p>

                <div className="mt-3 border-t border-stone-200/80 pt-2.5">
                  <span className="block text-[9px] font-mono uppercase tracking-wider text-copper">
                    {t(config.focusKey)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleTestInWorkbench(config.id)}
                  leftIcon={<FileText className="h-3 w-3 text-copper" />}
                  className="flex-1"
                >
                  {t('demoLoadInWorkbench')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleInspectInGate(config.id)}
                  rightIcon={<ArrowRight className="h-3 w-3" />}
                >
                  {t('demoInspectInGate')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
