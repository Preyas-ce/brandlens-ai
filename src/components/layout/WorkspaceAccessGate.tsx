import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { Brandmark } from '@/components/brand/Brandmark';
import { EagleFlightIntro } from '@/components/brand/EagleFlightIntro';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '@/contexts/AuthProvider';
import { useLanguage } from '@/contexts/LanguageProvider';
import { supabaseConfigurationError } from '@/services/supabaseClient';

export const WorkspaceAccessGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const auth = useAuth();
  const { t } = useLanguage();
  const [migrationError, setMigrationError] = useState('');
  const [migrationFeedback, setMigrationFeedback] = useState('');
  const [working, setWorking] = useState(false);

  const isDemoMode = typeof window !== 'undefined' && window.localStorage.getItem('brandlens.demo_mode') === 'true';

  if (!auth.configured) {
    return (
      <main className="min-h-screen bg-ivory flex items-center justify-center px-5 py-12 font-sans">
        <div className="max-w-2xl w-full">
          <Panel title="Supabase setup required" padding="lg">
            <p role="alert" className="text-sm text-copper-900">{supabaseConfigurationError}</p>
          </Panel>
        </div>
      </main>
    );
  }

  if (auth.loading) {
    return (
      <main className="min-h-screen bg-ivory flex items-center justify-center p-6 text-stone-600 font-sans">
        <div className="flex items-center gap-3 border border-stone-300 bg-ivory-50 px-5 py-4 shadow-xs">
          <LoaderCircle className="h-4 w-4 animate-spin text-copper" />
          <span className="text-xs font-mono uppercase tracking-wider">{t('importCheckingAccess')}</span>
        </div>
      </main>
    );
  }

  if (!auth.session && !isDemoMode) return <Navigate to="/auth" replace />;

  if (!auth.workspace && !isDemoMode) {
    return (
      <main className="min-h-screen bg-ivory flex flex-col justify-between font-sans p-6 sm:p-12">
        <div className="max-w-2xl mx-auto w-full my-auto">
          <Panel title={t('importUnavailableTitle')} padding="lg">
            <p role="alert" className="text-sm text-copper-900">
              {auth.error || t('importUnavailableFallback')}
            </p>
            <div className="mt-4">
              <Button variant="outline" onClick={() => void auth.signOut()}>
                {t('importSignOut')}
              </Button>
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  if (auth.migrationRequired && !isDemoMode && auth.workspace) {
    const run = async (action: () => Promise<unknown>) => {
      setWorking(true);
      setMigrationError('');
      setMigrationFeedback('');
      try {
        const result = await action();
        const summary = result as { alreadyImported?: boolean; importedRecords?: number } | undefined;
        setMigrationFeedback(summary?.alreadyImported
          ? 'This browser data has already been imported. Cloud records are now loaded.'
          : summary?.importedRecords === undefined
            ? 'Cloud workspace loaded. Your browser-local data remains unchanged.'
            : `Imported ${summary.importedRecords} review record(s). Your original browser data remains unchanged.`);
      } catch (error) {
        setMigrationError(error instanceof Error ? error.message : 'Workspace data could not be loaded.');
      } finally {
        setWorking(false);
      }
    };

    return (
      <div className="relative flex min-h-screen flex-col justify-between bg-ivory font-sans text-obsidian">
        {/* Subtle dot-matrix editorial background */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(#171916_0.75px,transparent_0.75px)] [background-size:16px_16px] opacity-30"
          aria-hidden="true"
        />

        {/* Top bar header */}
        <header className="relative z-10 flex items-center justify-between border-b border-stone-300/80 bg-ivory-50/80 px-6 py-4 backdrop-blur-xs">
          <Brandmark size="sm" showSubtitle={true} />
          <div className="flex items-center gap-3">
            {auth.session?.user?.email && (
              <span className="hidden text-xs text-stone-600 sm:inline-block font-mono">
                {auth.session.user.email} · <strong className="text-obsidian">{auth.role ?? 'member'}</strong>
              </span>
            )}
            <LanguageSwitcher />
          </div>
        </header>

        {/* Main centered editorial workspace setup */}
        <main className="relative z-10 mx-auto my-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="border border-stone-300/90 bg-ivory-50/95 p-6 shadow-xs sm:p-10">
            {/* Eagle Mascot One-Time Perimeter Flight & Perch Introduction */}
            <EagleFlightIntro
              userId={auth.session?.user?.id}
              workspaceId={auth.workspace?.id}
              actionInterrupted={working}
            />

            {/* Header section */}
            <div className="border-b border-stone-200 pb-6">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-copper" aria-hidden="true" />
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
                  {t('importScreenKicker')}
                </p>
              </div>
              <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight text-obsidian sm:text-4xl">
                {t('importScreenTitle')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                {t('importScreenDesc')}
              </p>
            </div>

            {/* Error and feedback notices */}
            {migrationError && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 border-l-2 border-copper bg-copper-50/90 px-4 py-3 text-xs text-copper-900"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-copper" />
                <span>{migrationError}</span>
              </div>
            )}
            {migrationFeedback && (
              <div
                role="status"
                className="mt-4 flex items-start gap-2.5 border-l-2 border-forest bg-forest-50/90 px-4 py-3 text-xs text-forest-800"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                <span>{migrationFeedback}</span>
              </div>
            )}

            {/* Choice cards */}
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Option 1: Import Local Records */}
              <div className="flex flex-col justify-between border border-copper/50 bg-ivory-100/60 p-5 shadow-xs transition-colors hover:border-copper">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-copper">
                      <UploadCloud className="h-4 w-4" />
                      Option A
                    </span>
                    <Badge variant="copper" size="sm">
                      Recommended
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-normal text-obsidian">
                    {t('importCardImportTitle')}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600">
                    {t('importCardImportDesc')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-200">
                  {auth.role === 'workspace_admin' ? (
                    <Button
                      variant="copper"
                      size="md"
                      disabled={working}
                      isLoading={working}
                      className="w-full justify-center"
                      leftIcon={working ? undefined : <UploadCloud className="h-4 w-4" />}
                      onClick={() => void run(auth.importLocalData)}
                    >
                      {t('importCardImportBtn')}
                    </Button>
                  ) : (
                    <p className="text-[11px] leading-relaxed text-stone-600 bg-stone-100 p-2.5" role="note">
                      {t('importAdminOnlyNote')}
                    </p>
                  )}
                </div>
              </div>

              {/* Option 2: Start Fresh in Cloud */}
              <div className="flex flex-col justify-between border border-stone-300 bg-ivory-100/30 p-5 shadow-xs transition-colors hover:border-stone-400">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-stone-600">
                      <Sparkles className="h-4 w-4 text-stone-500" />
                      Option B
                    </span>
                    <Badge variant="neutral" size="sm">
                      Cloud native
                    </Badge>
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-normal text-obsidian">
                    {t('importCardFreshTitle')}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600">
                    {t('importCardFreshDesc')}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-stone-200">
                  <Button
                    variant="outline"
                    size="md"
                    disabled={working}
                    className="w-full justify-center"
                    onClick={() => void run(auth.continueWithoutImport)}
                  >
                    {t('importCardFreshBtn')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom metadata and sign out */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-stone-200 pt-5 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-forest" />
                <span className="text-[11px]">{t('importNoticeSafe')}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={working}
                onClick={() => void auth.signOut()}
              >
                {t('importSignOut')}
              </Button>
            </div>
          </div>
        </main>

        {/* Minimal editorial footer */}
        <footer className="relative z-10 border-t border-stone-300/60 bg-ivory-50/50 px-6 py-3 text-center text-[10px] font-mono uppercase tracking-wider text-stone-500">
          BrandLens AI · Editorial Governance & Intelligent Content Inspection
        </footer>
      </div>
    );
  }

  return <>{children}</>;
};
