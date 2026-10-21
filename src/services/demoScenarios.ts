import { analyzeLocalContent } from '@/services/localReviewEngine';
import { readReviewRecords, saveReviewRecord } from '@/services/reviewStorage';
import { getWorkspaceAnalysisConfigHash, readWorkspaceSettings } from '@/services/workspaceStorage';
import { ReviewSubmission } from '@/types/review';

export interface DemoScenario {
  id: string;
  title: string;
  contentType: string;
  content: string;
  author: string;
  campaign: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'needs-review',
    title: 'Demo · Launch claim review',
    contentType: 'Advertisement',
    author: 'BrandLens Demo Writer',
    campaign: 'Demo campaign · Product launch',
    content: 'Our revolutionary platform guarantees a 35% increase in conversions. It creates synergy across every team. Brandlens helps editorial teams prepare campaign copy.',
  },
  {
    id: 'evidence-review',
    title: 'Demo · Evidence and claim review',
    contentType: 'Landing page',
    author: 'BrandLens Demo Writer',
    campaign: 'Demo campaign · Evidence review',
    content: 'Our service has a 99.99% availability target. The local catalogue includes an internal demo wording record for the 99.99% availability target; that record is explicitly unverified and is not an external service-level source.\n\nSeparately, our product guarantees a 35% increase in conversions.',
  },
  {
    id: 'clean-approval',
    title: 'Demo · Editorial governance announcement',
    contentType: 'Email',
    author: 'BrandLens Demo Writer',
    campaign: 'Demo campaign · Editorial governance',
    content: 'BrandLens AI helps editorial teams apply approved brand rules and review available evidence before a human decides whether content is ready for publication.',
  },
];

const toSubmission = (scenario: DemoScenario, brandName: string): ReviewSubmission => ({
  title: scenario.title.replace('BrandLens', brandName),
  contentType: scenario.contentType,
  campaign: scenario.campaign.replace('BrandLens', brandName),
  author: scenario.author,
  content: scenario.content.replace(/BrandLens/g, brandName),
});

export const prepareDemoScenarios = (): { created: number; existing: number } => {
  const records = readReviewRecords();
  const existingScenarioIds = new Set(records.map((record) => record.demoScenarioId).filter((id): id is string => Boolean(id)));
  const settings = readWorkspaceSettings();
  let created = 0;

  for (const scenario of DEMO_SCENARIOS) {
    if (existingScenarioIds.has(scenario.id)) continue;
    const submission = toSubmission(scenario, settings.demoBrandName);
    const analysis = analyzeLocalContent(submission.content);
    const summary = `${analysis.summary} Local demo rules only; no live AI model or external fact-checking is used.`;
    saveReviewRecord(submission, analysis.score, analysis.findings, summary, getWorkspaceAnalysisConfigHash(), scenario.id);
    created += 1;
  }

  return { created, existing: DEMO_SCENARIOS.length - created };
};
