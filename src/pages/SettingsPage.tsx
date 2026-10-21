import React, { useEffect, useState } from 'react';
import { 
  Database, 
  FilePlus2,
  RotateCcw, 
  Save
} from 'lucide-react';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  readWorkspaceSettings,
  restoreWorkspaceSettings,
  saveWorkspaceSettings,
  WORKSPACE_DATA_STORAGE_KEY,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { DEMO_SCENARIOS, prepareDemoScenarios } from '@/services/demoScenarios';
import { resetDemoReviewRecords } from '@/services/reviewStorage';
import { WorkspaceSettings } from '@/types/workspace';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [demoFeedback, setDemoFeedback] = useState('');
  const [demoError, setDemoError] = useState('');

  useEffect(() => {
    const refreshSettings = () => {
      try {
        setSettings(readWorkspaceSettings());
      } catch (error) {
        setSettingsError(error instanceof Error ? error.message : 'Workspace settings could not be loaded.');
      }
    };
    refreshSettings();
    window.addEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshSettings);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_DATA_STORAGE_KEY) refreshSettings();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(WORKSPACE_DATA_UPDATED_EVENT, refreshSettings);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.workspaceName.trim() || !settings.demoBrandName.trim()) {
      setSettingsError('Workspace and brand names cannot be empty.');
      return;
    }
    if (settings.requireNamedSignature && !settings.reviewerDisplayName.trim()) {
      setSettingsError('Enter a reviewer display name or disable the named-signature preference.');
      return;
    }
    try {
      const savedSettings = saveWorkspaceSettings({
        ...settings,
        workspaceName: settings.workspaceName.trim(),
        demoBrandName: settings.demoBrandName.trim(),
        reviewerDisplayName: settings.reviewerDisplayName.trim(),
      });
      setSettings(savedSettings);
      setSettingsError('');
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'Workspace settings could not be saved.');
    }
  };

  const restoreDefaults = () => {
    if (confirm('Restore workspace settings only? Reviews, guidelines, evidence, and audit history will be preserved.')) {
      try {
        setSettings(restoreWorkspaceSettings());
        setSettingsError('');
      } catch (error) {
        setSettingsError(error instanceof Error ? error.message : 'Default settings could not be restored.');
      }
    }
  };

  const prepareDemoRecords = () => {
    const scenarioList = DEMO_SCENARIOS.map((scenario) => `• ${scenario.title}`).join('\n');
    if (!window.confirm(`Create any missing demo submissions?\n\n${scenarioList}\n\nThey will be analysed with the active workspace rules and added as awaiting human review. Existing reviews, guidelines, evidence, settings, and history will not be replaced.`)) return;
    try {
      const result = prepareDemoScenarios();
      setDemoFeedback(result.created
        ? `${result.created} demo submission${result.created === 1 ? '' : 's'} prepared and analysed. ${result.existing} already existed. All are awaiting a human decision.`
        : 'All demo scenarios already exist. No duplicate review records were created.');
      setDemoError('');
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Demo submissions could not be prepared.');
      setDemoFeedback('');
    }
  };

  const clearDemoRecords = () => {
    if (!window.confirm('Remove only the review records marked as BrandLens demo scenarios, including their revision and decision history? Your other review records, guidelines, evidence, workspace settings, and workspace audit events will be preserved.')) return;
    try {
      const removed = resetDemoReviewRecords();
      setDemoFeedback(removed
        ? `${removed} demo review record${removed === 1 ? '' : 's'} removed with ${removed === 1 ? 'its' : 'their'} associated review history. Workspace data and other reviews were preserved.`
        : 'No marked demo review records were found.');
      setDemoError('');
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : 'Demo review records could not be removed.');
      setDemoFeedback('');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-stone-300 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-widest font-mono text-copper font-bold">
              Configuration
            </span>
          </div>
          <h2 className="font-serif text-3xl font-normal text-obsidian tracking-tight">
            Governance & Workspace Settings
          </h2>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Configure the Human Verification Gate parameters, analysis thresholds, and browser local storage persistence.
          </p>
        </div>

        {savedFeedback && (
          <Badge variant="forest" size="md" dot>
            Settings Saved
          </Badge>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Workspace Identity */}
        <Panel
          kicker="WORKSPACE METADATA"
          title="Brand Organization Identity"
          subtitle="Workspace details visible on verification records and audit exports"
          padding="md"
        >
          <div className="max-w-xl space-y-4">
            <Input
              label="Organization Workspace Name"
              value={settings.workspaceName}
              onChange={(e) => setSettings({ ...settings, workspaceName: e.target.value })}
              helperText="Identifies your editorial division in the audit ledger"
            />
            <Input
              label="Demo Brand Name"
              value={settings.demoBrandName}
              onChange={(e) => setSettings({ ...settings, demoBrandName: e.target.value })}
              helperText="Workspace identity used by the local prototype; it does not change prior analysis records."
            />
            <Input
              label="Demo Reviewer Display Name"
              value={settings.reviewerDisplayName}
              onChange={(e) => setSettings({ ...settings, reviewerDisplayName: e.target.value })}
              helperText="Used for future human decisions and governance audit events. This is not production authentication."
              required={settings.requireNamedSignature}
            />
          </div>
        </Panel>

        {/* Human Verification Gate Configuration */}
        <Panel
          kicker="PUBLICATION POLICY"
          title="Human Verification Gate Enforcement"
          subtitle="Prioritize human attention. The final publication approval always remains a human decision."
          padding="md"
        >
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-3">
              <label className="block text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-stone-700">
                Gate Strictness Level
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Gate Strictness Level">
                <div
                  role="radio"
                  aria-checked={settings.gateStrictness === 'strict'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') setSettings({ ...settings, gateStrictness: 'strict' });
                  }}
                  onClick={() => setSettings({ ...settings, gateStrictness: 'strict' })}
                  className={`p-4 rounded-[3px] border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
                    settings.gateStrictness === 'strict'
                      ? 'border-copper bg-copper-50/50 ring-1 ring-copper'
                      : 'border-stone-300 bg-ivory-50/80 hover:bg-stone-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs md:text-sm text-obsidian">Strict Gate (Mandatory)</span>
                    <Badge variant="copper" size="sm">Recommended</Badge>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Prioritize critical and moderate findings for human review. Every publication decision still requires a human reviewer.
                  </p>
                </div>

                <div
                  role="radio"
                  aria-checked={settings.gateStrictness === 'flexible'}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') setSettings({ ...settings, gateStrictness: 'flexible' });
                  }}
                  onClick={() => setSettings({ ...settings, gateStrictness: 'flexible' })}
                  className={`p-4 rounded-[3px] border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
                    settings.gateStrictness === 'flexible'
                      ? 'border-copper bg-copper-50/50 ring-1 ring-copper'
                      : 'border-stone-300 bg-ivory-50/80 hover:bg-stone-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs md:text-sm text-obsidian">Advisory Gate</span>
                    <Badge variant="stone" size="sm">Permissive</Badge>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Prioritize critical findings; other findings remain visible to the reviewer. This never bypasses human verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireNamedSignature}
                  onChange={(e) => setSettings({ ...settings, requireNamedSignature: e.target.checked })}
                  className="mt-1 rounded-[2px] border-stone-300 text-copper focus:ring-copper"
                />
                <div>
                  <span className="text-sm font-medium text-obsidian">
                    Require a named reviewer identity
                  </span>
                  <p className="text-xs text-stone-600">
                    When enabled, decisions require a configured display name. This prototype does not verify a person's real-world identity.
                  </p>
                </div>
              </label>


              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-obsidian-700 mb-1">
                  Queue Attention Threshold: {settings.minPassScore}/100
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={settings.minPassScore}
                  onChange={(e) => setSettings({ ...settings, minPassScore: Number(e.target.value) })}
                  className="w-full accent-copper cursor-pointer"
                />
                <p className="text-xs text-stone-500 mt-1">
                  Lower-scoring reviews are surfaced as priority attention in the human queue. Scores never approve or block a human decision.
                </p>
              </div>
            </div>
          </div>
        </Panel>

        {/* Local Storage & Engine Controls */}
        <Panel
          title="Local State & Storage Architecture"
          subtitle="Manage client-side prototype persistence"
          padding="md"
        >
          <div className="space-y-4 max-w-xl">
            <div className="p-3 bg-stone-100 rounded-[3px] border border-stone-200 text-xs text-stone-700 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-obsidian">
                <Database className="w-4 h-4 text-copper" />
                <span>Zero Cloud Dependency Mode</span>
              </div>
              <p>
                Brand rules, review records, and analysis reports use browser localStorage. This is prototype persistence, not a secure production database, and browser data can be cleared or changed.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={restoreDefaults}
              >
                Restore Workspace Settings
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          kicker="DEMO WORKSPACE"
          title="Repeatable review scenarios"
          subtitle="Prepare real local review records to demonstrate analysis, evidence, revisions, and the human gate."
          padding="md"
        >
          <div className="max-w-2xl space-y-3">
            <p className="text-xs leading-relaxed text-stone-600">
              Demo submissions run through the same local analysis and approval workflow as regular content. They are not pre-approved. Repeating setup skips existing demo scenarios.
            </p>
            {demoFeedback && <p role="status" className="border-l-2 border-forest bg-forest-50 px-3 py-2 text-xs text-forest-900">{demoFeedback}</p>}
            {demoError && <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{demoError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="copper" size="sm" leftIcon={<FilePlus2 className="h-3.5 w-3.5" />} onClick={prepareDemoRecords}>
                Prepare demo reviews
              </Button>
              <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clearDemoRecords}>
                Reset demo reviews
              </Button>
            </div>
            <p className="text-[10px] leading-relaxed text-stone-500">
              Reset removes only marked demo review records and their review history. It does not change guidelines, evidence, settings, workspace audit events, or non-demo reviews.
            </p>
          </div>
        </Panel>

        <div className="pt-2 flex items-center justify-end gap-3">
          {settingsError && <p role="alert" className="mr-auto text-xs text-copper-900">{settingsError}</p>}
          <Button
            type="submit"
            variant="copper"
            size="md"
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Publication Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
