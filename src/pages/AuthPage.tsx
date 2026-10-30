import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Info,
  Lock,
  ScanEye,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Brandmark } from '@/components/brand/Brandmark';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { EditorialTaskLamp } from '@/components/brand/EditorialTaskLamp';
import { EditorialDeskCompanion } from '@/components/brand/EditorialDeskCompanion';
import { FirstSignInWelcome } from '@/components/brand/FirstSignInWelcome';
import { useAuth } from '@/contexts/AuthProvider';
import { useLanguage } from '@/contexts/LanguageProvider';
import { hasUserSeenWelcome, markUserWelcomeSeen } from '@/services/welcomePreferences';
import {
  hasJudgeDemoTourBeenSeen,
  isJudgeDemoEmail,
  isJudgeDemoSessionActive,
  markJudgeDemoTourSeen,
  setJudgeDemoSession,
  setPendingRegistrationTour,
} from '@/services/onboardingPreferences';
import { supabase, supabaseConfigurationError } from '@/services/supabaseClient';

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export const AuthPage: React.FC = () => {
  const auth = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [formError, setFormError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const [showJudgePassword, setShowJudgePassword] = useState(false);
  const [enteringJudgeDemo, setEnteringJudgeDemo] = useState(false);
  const [judgeError, setJudgeError] = useState('');

  // Password Recovery Flow State
  const [resetSending, setResetSending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const processedCodeRef = useRef<string | null>(null);

  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const isRecoveryQuery = searchParams.get('mode') === 'recovery';
  const isRecoveryMode = isRecoveryQuery || auth.passwordRecovery;

  const rawJudgeEmail = typeof import.meta !== 'undefined' ? import.meta.env.VITE_JUDGE_DEMO_EMAIL : undefined;
  const rawJudgePassword = typeof import.meta !== 'undefined' ? import.meta.env.VITE_JUDGE_DEMO_PASSWORD : undefined;
  const judgeEmail = rawJudgeEmail ? rawJudgeEmail.trim() : '';
  const judgePassword = rawJudgePassword ? rawJudgePassword.trim() : '';
  const isJudgeConfigured = Boolean(judgeEmail && judgePassword);

  useEffect(() => {
    // Detect redirect parameters from email confirmation or Supabase authentication callbacks
    const parseAuthRedirect = () => {
      if (typeof window === 'undefined') return;

      const search = new URLSearchParams(window.location.search);
      let hash = window.location.hash || '';
      if (hash.startsWith('#')) {
        hash = hash.substring(1);
      }
      const hashParams = new URLSearchParams(hash);

      const error = search.get('error') || hashParams.get('error');
      const errorDescription = search.get('error_description') || hashParams.get('error_description');

      if (error || errorDescription) {
        const decoded = errorDescription ? decodeURIComponent(errorDescription.replace(/\+/g, ' ')) : error;
        if (/expired|invalid|not found|already/i.test(decoded || '')) {
          if (search.get('mode') === 'recovery' || hashParams.get('type') === 'recovery') {
            setFormError(t('authRecoveryExpired'));
          } else {
            setFormError(t('authEmailConfirmationExpired'));
          }
        } else {
          setFormError(decoded || t('authEmailConfirmationFailed'));
        }
        return;
      }

      const type = search.get('type') || hashParams.get('type');
      if (type === 'signup' || search.get('confirmed') === 'true') {
        setFeedback(t('authEmailConfirmedSuccess'));
      }

      // If PKCE exchange code is present, prevent duplicate processing
      const code = search.get('code');
      if (code && supabase && !auth.session && processedCodeRef.current !== code) {
        processedCodeRef.current = code;
        if (search.get('mode') === 'recovery') {
          setFeedback(t('authRecoveryVerifying'));
        } else {
          setFeedback(t('authVerifyingEmail'));
        }
        supabase.auth.exchangeCodeForSession(code).then(async ({ error: exchangeError }) => {
          if (exchangeError) {
            // Check if detectSessionInUrl already processed this session concurrently
            const sessionData = supabase ? (await supabase.auth.getSession()).data : null;
            if (sessionData?.session) {
              setFeedback('');
              return;
            }
            setFeedback('');
            if (search.get('mode') === 'recovery') {
              setFormError(t('authRecoveryExpired'));
            } else {
              setFormError(exchangeError.message);
            }
          }
        }).catch(async (cause: unknown) => {
          const sessionData = supabase ? (await supabase.auth.getSession()).data : null;
          if (sessionData?.session) {
            setFeedback('');
            return;
          }
          setFeedback('');
          if (search.get('mode') === 'recovery') {
            setFormError(t('authRecoveryExpired'));
          } else {
            setFormError(cause instanceof Error ? cause.message : t('authEmailConfirmationFailed'));
          }
        });
      }
    };

    parseAuthRedirect();
  }, [auth.session, t]);

  const currentUser = auth.session?.user;
  const isJudgeSession = Boolean(
    currentUser && (
      isJudgeDemoSessionActive() ||
      (judgeEmail && isJudgeDemoEmail(currentUser.email, judgeEmail))
    )
  );

  const isJudgeFirstRun = Boolean(
    isJudgeSession && currentUser && !hasJudgeDemoTourBeenSeen(currentUser.id)
  );

  const isWelcomeNeeded = Boolean(
    !isRecoveryMode &&
    currentUser &&
    !auth.loading &&
    !welcomeDismissed &&
    (isJudgeFirstRun || !hasUserSeenWelcome(currentUser.id))
  );

  // If session is already authenticated and welcome has already been seen, redirect to dashboard UNLESS in recovery mode
  if (auth.session && !auth.loading && !isWelcomeNeeded && !isRecoveryMode) {
    return <Navigate to="/dashboard" replace />;
  }

  // First-sign-in or email confirmation welcome experience
  if (isWelcomeNeeded && currentUser) {
    return (
      <FirstSignInWelcome
        userEmail={currentUser.email}
        workspaceName={auth.workspace?.name}
        onComplete={() => {
          if (currentUser) {
            markUserWelcomeSeen(currentUser.id);
            if (isJudgeSession) {
              markJudgeDemoTourSeen(currentUser.id);
              setPendingRegistrationTour(currentUser.id, currentUser.email);
            }
          }
          setWelcomeDismissed(true);
          navigate('/dashboard');
        }}
      />
    );
  }

  const handleCopy = (field: 'email' | 'password', value: string) => {
    if (!value) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch {
      // Graceful fallback
    }
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((curr) => (curr === field ? null : curr));
    }, 2000);
  };

  const handleEnterJudgeDemo = async () => {
    if (!isJudgeConfigured) return;
    setEnteringJudgeDemo(true);
    setJudgeError('');
    setFormError('');
    setFeedback('');
    window.localStorage.removeItem('brandlens.demo_mode');
    setJudgeDemoSession(true);

    try {
      await auth.signIn(judgeEmail, judgePassword);

      let userId: string | undefined = auth.session?.user?.id;
      if (!userId && supabase) {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user?.id;
      }

      if (userId && hasJudgeDemoTourBeenSeen(userId) && hasUserSeenWelcome(userId)) {
        navigate('/dashboard');
      }
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : 'Judge demo authentication failed.');
      setJudgeDemoSession(false);
    } finally {
      setEnteringJudgeDemo(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError('');
    setFeedback('');
    window.localStorage.removeItem('brandlens.demo_mode');

    try {
      const normalizedEmail = email.trim();
      if (mode === 'sign_up') {
        const normalizedUsername = username.trim().toLowerCase();
        if (!USERNAME_PATTERN.test(normalizedUsername)) {
          throw new Error('Username must be 3–24 characters and contain only letters, numbers, and underscores.');
        }
        if (!workspaceName.trim()) {
          throw new Error('Enter a workspace name to continue.');
        }

        await auth.signUp(normalizedEmail, password, workspaceName.trim(), normalizedUsername);
        setFeedback(
          `Registration submitted for ${normalizedEmail}. Check your email and confirm the address before signing in. For local development, check Mailpit at http://127.0.0.1:54324.`,
        );
      } else {
        await auth.signIn(normalizedEmail, password);

        // Check if user has already seen welcome; if so, navigate immediately
        let userId: string | undefined = auth.session?.user?.id;
        if (!userId && supabase) {
          const { data } = await supabase.auth.getSession();
          userId = data.session?.user?.id;
        }

        const isUserJudge = Boolean(
          isJudgeDemoSessionActive() ||
          (judgeEmail && isJudgeDemoEmail(normalizedEmail, judgeEmail))
        );

        if (userId) {
          if (isUserJudge && !hasJudgeDemoTourBeenSeen(userId)) {
            // First run for judge: do not navigate away, let FirstSignInWelcome display
          } else if (hasUserSeenWelcome(userId)) {
            navigate('/dashboard');
          }
        }
        // If not seen, the active auth.session change will trigger the FirstSignInWelcome view automatically
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Authentication could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (newMode: 'sign_in' | 'sign_up') => {
    if (newMode !== mode) {
      setMode(newMode);
      setFormError('');
      setFeedback('');
    }
  };

  const handleForgotPassword = async () => {
    setFormError('');
    setFeedback('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setFormError(t('authPasswordResetEmailRequired'));
      return;
    }
    setResetSending(true);
    try {
      await auth.requestPasswordReset(trimmedEmail);
      setFeedback(t('authPasswordResetSuccessGeneric'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('authPasswordResetFailed'));
    } finally {
      setResetSending(false);
    }
  };

  const handleCancelRecovery = async () => {
    if (auth.session) {
      try {
        await auth.signOut();
      } catch {
        // Safe fallback
      }
    }
    setFormError('');
    setFeedback('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoverySuccess(false);
    navigate('/auth', { replace: true });
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setFeedback('');

    if (newPassword.length < 8) {
      setFormError(t('authRecoveryPasswordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError(t('authRecoveryPasswordMismatch'));
      return;
    }

    setUpdatingPassword(true);
    try {
      await auth.updateRecoveredPassword(newPassword);
      setRecoverySuccess(true);
      setFeedback(t('authRecoverySuccess'));
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1800);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-ivory text-obsidian flex flex-col justify-between selection:bg-copper/25 selection:text-obsidian font-sans overflow-x-hidden">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.12fr_1fr] min-h-screen">
        {/* Left Column: Brand Story, Lamp Scene & Editorial Authority Panel */}
        <div className="relative bg-[#171916] text-ivory p-5 sm:p-8 lg:p-12 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-stone-800">
          {/* Subtle architectural tactile backdrop */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[radial-gradient(#F6F1E8_1px,transparent_1px)] [background-size:20px_20px]"
            aria-hidden="true"
          />
          <div
            className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-copper/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col justify-between h-full space-y-4 sm:space-y-6 lg:space-y-8">
            <div>
              {/* Brand Header */}
              <div className="flex items-center gap-3">
                <Brandmark size="md" theme="dark" showSubtitle={false} />
                <div>
                  <span className="font-serif text-xl font-bold tracking-tight text-ivory block">
                    BrandLens AI
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-copper-300 block">
                    {t('authKicker')}
                  </span>
                </div>
              </div>

              {/* Headline & Value Proposition */}
              <div className="mt-4 sm:mt-6 lg:mt-8 max-w-xl">
                <h1 className="font-serif text-2xl sm:text-3xl lg:text-[2.6rem] font-normal leading-[1.15] lg:leading-[1.1] tracking-tight text-ivory">
                  {t('authHeadline')}
                </h1>
                <p className="mt-2 sm:mt-3.5 text-xs sm:text-sm text-stone-300 leading-relaxed font-sans max-w-lg">
                  {t('authHeroDescription')}
                </p>
              </div>

              {/* Remodeled Architectural Editorial Table Lamp Centerpiece */}
              <div className="my-2 sm:my-4 lg:my-6 flex flex-col items-center lg:items-start">
                <div className="w-20 sm:w-36 lg:w-64 aspect-square">
                  <EditorialTaskLamp
                    isLit={true}
                    interactive={true}
                    idPrefix="auth-story-lamp"
                    ariaLabel="BrandLens AI architectural editorial table lamp"
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-center lg:justify-start gap-x-2 gap-y-0.5 text-[8.5px] sm:text-[9px] font-mono uppercase tracking-[0.16em] text-stone-400" aria-hidden="true">
                  <span className="hidden sm:inline h-px w-4 sm:w-6 bg-copper/40" />
                  <span>{t('authLampCaption')}</span>
                  <span className="text-copper-400">•</span>
                  <span className="text-copper-300">{t('authLampInteractive')}</span>
                  <span className="hidden sm:inline h-px w-4 sm:w-6 bg-copper/40" />
                </div>
                <div className="mt-1 sm:mt-2.5">
                  <EditorialDeskCompanion />
                </div>
              </div>

              {/* Three Distinct Pillars */}
              <div className="mt-2 sm:mt-4 space-y-1.5 sm:space-y-0 sm:grid sm:grid-cols-3 lg:grid-cols-1 lg:space-y-3 sm:gap-2.5 max-w-lg">
                <div className="flex items-start gap-2 sm:gap-2.5 lg:gap-3 p-2 sm:p-2.5 lg:p-3 rounded-sm border border-stone-800/80 bg-obsidian-900/60 backdrop-blur-xs">
                  <div className="grid h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 shrink-0 place-items-center rounded-sm bg-copper/20 text-copper-300">
                    <BookOpenCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-[11px] sm:text-xs lg:text-sm font-medium text-ivory">
                      {t('authPillar1Title')}
                    </h3>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] lg:text-xs text-stone-400 leading-relaxed">
                      {t('authPillar1Desc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-2.5 lg:gap-3 p-2 sm:p-2.5 lg:p-3 rounded-sm border border-stone-800/80 bg-obsidian-900/60 backdrop-blur-xs">
                  <div className="grid h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 shrink-0 place-items-center rounded-sm bg-forest/30 text-forest-300">
                    <ScanEye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-[11px] sm:text-xs lg:text-sm font-medium text-ivory">
                      {t('authPillar2Title')}
                    </h3>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] lg:text-xs text-stone-400 leading-relaxed">
                      {t('authPillar2Desc')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 sm:gap-2.5 lg:gap-3 p-2 sm:p-2.5 lg:p-3 rounded-sm border border-stone-800/80 bg-obsidian-900/60 backdrop-blur-xs">
                  <div className="grid h-5 w-5 sm:h-6 sm:w-6 lg:h-7 lg:w-7 shrink-0 place-items-center rounded-sm bg-copper/20 text-copper-300">
                    <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  </div>
                  <div>
                    <h3 className="font-serif text-[11px] sm:text-xs lg:text-sm font-medium text-ivory">
                      {t('authPillar3Title')}
                    </h3>
                    <p className="mt-0.5 text-[10px] sm:text-[11px] lg:text-xs text-stone-400 leading-relaxed">
                      {t('authPillar3Desc')}
                    </p>
                  </div>
                </div>
              </div>

              {/* BrandLens Eagle Mascot Welcome Card */}
              <div
                data-testid="auth-eagle-greeting"
                className="mt-3 sm:mt-4 p-2.5 sm:p-3 rounded-[3px] border border-stone-800/90 bg-obsidian-900/80 backdrop-blur-xs flex items-center gap-3 shadow-xs"
              >
                <div className="relative h-11 w-11 sm:h-12 sm:w-12 shrink-0 rounded-full border border-copper/80 overflow-hidden shadow-xs bg-obsidian">
                  <img
                    src="/mascot-eagle.jpg"
                    alt="BrandLens Eagle Mascot"
                    className="h-full w-full object-cover object-top"
                  />
                  <span
                    className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-forest border-2 border-obsidian"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[8.5px] font-mono font-bold uppercase tracking-[0.2em] text-copper-300 block">
                    {t('authEagleGreetingTag')}
                  </span>
                  <h4 className="font-serif text-xs sm:text-sm font-medium text-ivory leading-tight mt-0.5">
                    {t('authEagleGreetingTitle')}
                  </h4>
                  <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-stone-300 leading-snug">
                    {t('authEagleGreetingDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Editorial Trust Notice */}
            <div className="pt-3 sm:pt-4 border-t border-stone-800/90 flex items-start gap-2.5 sm:gap-3 text-xs text-stone-400">
              <span className="h-2 w-2 rounded-full bg-forest-400 shrink-0 mt-1 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
              <p className="leading-relaxed text-[11px]">
                {t('authTrustNotice')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card Panel */}
        <div className="bg-ivory flex flex-col justify-between p-4 sm:p-8 lg:p-12 min-h-0">
          {/* Top Bar with Language Switcher */}
          <div className="flex items-center justify-end">
            <LanguageSwitcher />
          </div>

          {/* Centered Authentication Form Box */}
          <div className="w-full max-w-md mx-auto my-auto py-3 sm:py-6">
            {!isRecoveryMode && (
              <>
                {/* Dedicated Public Judge Demo Access Card */}
                <section
                  data-testid="judge-demo-card"
                  aria-label={t('authJudgeDemoTitle')}
                  className="border border-stone-300 bg-[#FAF7F2] p-4 sm:p-5 shadow-[0_4px_16px_rgba(23,25,22,0.04)] rounded-sm mb-4"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-stone-200/80 pb-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-forest shadow-[0_0_6px_rgba(36,76,58,0.5)]" aria-hidden="true" />
                      <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
                        {t('authJudgeDemoBadge')}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-mono text-stone-500 uppercase tracking-wider">
                      Role: Reviewer
                    </span>
                  </div>

                  <div className="mb-3">
                    <h2 className="font-serif text-lg font-normal text-obsidian tracking-tight flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-copper shrink-0" aria-hidden="true" />
                      <span>{t('authJudgeDemoTitle')}</span>
                    </h2>
                    <p className="mt-0.5 text-xs text-stone-600 leading-relaxed">
                      {t('authJudgeDemoDesc')}
                    </p>
                  </div>

                  {isJudgeConfigured ? (
                    <div className="space-y-2.5">
                      {/* Credentials Grid */}
                      <div className="space-y-2 bg-stone-100/70 p-2.5 rounded border border-stone-200/90 text-xs">
                        {/* Demo Email Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[9.5px] font-mono uppercase tracking-wider text-stone-500 block">
                              {t('authJudgeDemoEmailLabel')}
                            </span>
                            <code
                              data-testid="judge-demo-email"
                              className="font-mono text-xs text-obsidian font-semibold select-all truncate block"
                            >
                              {judgeEmail}
                            </code>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy('email', judgeEmail)}
                            aria-label={t('authJudgeDemoCopyEmail')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-medium rounded border border-stone-300 bg-ivory text-stone-700 hover:text-obsidian hover:border-copper/70 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-copper shrink-0"
                          >
                            {copiedField === 'email' ? (
                              <>
                                <Check className="h-3 w-3 text-forest" />
                                <span className="text-forest font-bold">{t('authJudgeDemoCopied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-stone-500" />
                                <span>{t('authJudgeDemoCopyEmail')}</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="border-t border-stone-200/70 pt-2 flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[9.5px] font-mono uppercase tracking-wider text-stone-500 block">
                              {t('authJudgeDemoPasswordLabel')}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <code
                                data-testid="judge-demo-password"
                                className="font-mono text-xs text-obsidian font-semibold select-all truncate block"
                              >
                                {showJudgePassword ? judgePassword : '••••••••••••••••'}
                              </code>
                              <button
                                type="button"
                                onClick={() => setShowJudgePassword(!showJudgePassword)}
                                aria-label={showJudgePassword ? t('authJudgeDemoHidePassword') : t('authJudgeDemoShowPassword')}
                                className="p-0.5 text-stone-400 hover:text-stone-700 focus-visible:outline-none focus-visible:text-copper transition-colors"
                              >
                                {showJudgePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy('password', judgePassword)}
                            aria-label={t('authJudgeDemoCopyPassword')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-medium rounded border border-stone-300 bg-ivory text-stone-700 hover:text-obsidian hover:border-copper/70 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-copper shrink-0"
                          >
                            {copiedField === 'password' ? (
                              <>
                                <Check className="h-3 w-3 text-forest" />
                                <span className="text-forest font-bold">{t('authJudgeDemoCopied')}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-stone-500" />
                                <span>{t('authJudgeDemoCopyPassword')}</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {judgeError && (
                        <div
                          role="alert"
                          className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-2.5 text-xs text-copper-900"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-copper mt-0.5" />
                          <span>{judgeError}</span>
                        </div>
                      )}

                      {/* One-click Action Button */}
                      <Button
                        type="button"
                        variant="copper"
                        size="md"
                        data-testid="enter-judge-demo-btn"
                        className="w-full justify-center font-mono text-xs uppercase tracking-wider font-semibold shadow-xs flex-nowrap"
                        isLoading={enteringJudgeDemo}
                        disabled={enteringJudgeDemo}
                        onClick={handleEnterJudgeDemo}
                      >
                        <span className="inline-flex items-center justify-center gap-2 flex-nowrap whitespace-nowrap">
                          <span>{enteringJudgeDemo ? t('authJudgeDemoEntering') : t('authJudgeDemoEnterBtn')}</span>
                          {!enteringJudgeDemo && (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                        </span>
                      </Button>

                      <p className="text-[10px] text-stone-500 leading-tight text-center font-mono">
                        {t('authJudgeDemoRoleNote')}
                      </p>
                    </div>
                  ) : (
                    <div
                      data-testid="judge-demo-setup-notice"
                      className="p-3 rounded border border-amber-300/80 bg-amber-50/70 text-xs text-amber-950 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-amber-900">
                        <Info className="h-4 w-4 shrink-0 text-amber-700" />
                        <span>{t('authJudgeDemoNotConfiguredTitle')}</span>
                      </div>
                      <p className="text-[11px] text-amber-900/90 leading-relaxed font-sans">
                        {t('authJudgeDemoNotConfiguredDesc')}
                      </p>
                      <p className="text-[10px] font-mono text-amber-800 pt-1 border-t border-amber-200/70">
                        {t('authJudgeDemoExploreLocalPrompt')}
                      </p>
                    </div>
                  )}
                </section>

                {/* Separator */}
                <div className="relative my-4 select-none" aria-hidden="true">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-300/80" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider">
                    <span className="bg-ivory px-2.5 text-stone-500">
                      {mode === 'sign_in' ? 'Or Sign In with Organization Account' : 'Or Register New Organization'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {isRecoveryMode ? (
              <div
                data-testid="password-recovery-card"
                className="border border-stone-300 bg-[#FAF7F2] p-5 sm:p-8 shadow-[0_12px_32px_rgba(23,25,22,0.06)] rounded-sm"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-forest shadow-[0_0_6px_rgba(36,76,58,0.5)]" aria-hidden="true" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-copper">
                    {t('authRecoveryBadge')}
                  </span>
                </div>

                <div className="mb-6">
                  <h2 className="font-serif text-2xl font-normal text-obsidian tracking-tight">
                    {t('authRecoveryTitle')}
                  </h2>
                  <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                    {t('authRecoverySubtitle')}
                  </p>
                </div>

                {auth.loading ? (
                  <div className="p-8 text-center text-xs font-mono text-stone-600 space-y-3">
                    <div className="inline-block animate-spin h-5 w-5 border-2 border-copper border-t-transparent rounded-full" />
                    <p>{t('authRecoveryVerifying')}</p>
                  </div>
                ) : !auth.session && !auth.passwordRecovery ? (
                  <div className="space-y-4">
                    <div
                      role="alert"
                      className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-3 text-xs text-copper-900"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-copper mt-0.5" />
                      <span>{formError || t('authRecoveryExpired')}</span>
                    </div>

                    <Button
                      type="button"
                      variant="copper"
                      size="md"
                      className="w-full justify-center"
                      onClick={handleCancelRecovery}
                    >
                      {t('authRecoveryBackToSignIn')}
                    </Button>
                  </div>
                ) : recoverySuccess ? (
                  <div className="space-y-4">
                    <div
                      role="status"
                      className="flex items-start gap-2 border-l-2 border-forest bg-forest-50 p-3.5 text-xs text-forest-900"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-forest mt-0.5" />
                      <span>{feedback || t('authRecoverySuccess')}</span>
                    </div>

                    <Button
                      type="button"
                      variant="copper"
                      size="md"
                      className="w-full justify-center"
                      onClick={() => navigate('/dashboard', { replace: true })}
                    >
                      {t('authRecoveryContinueBtn')}
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="relative">
                      <Input
                        label={t('authRecoveryNewPasswordLabel')}
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        helperText={t('authRecoveryPasswordTooShort')}
                        rightIcon={
                          <button
                            type="button"
                            aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="pointer-events-auto p-1 text-stone-400 hover:text-stone-700 focus-visible:outline-none focus-visible:text-copper transition-colors"
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                    </div>

                    <div className="relative">
                      <Input
                        label={t('authRecoveryConfirmPasswordLabel')}
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        required
                        minLength={8}
                        placeholder="••••••••••••"
                        rightIcon={
                          <button
                            type="button"
                            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="pointer-events-auto p-1 text-stone-400 hover:text-stone-700 focus-visible:outline-none focus-visible:text-copper transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />
                    </div>

                    {(formError || auth.error) && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-3 text-xs text-copper-900"
                      >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-copper mt-0.5" />
                        <span>{formError || auth.error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="copper"
                      size="md"
                      data-testid="update-password-btn"
                      className="w-full justify-center mt-2"
                      isLoading={updatingPassword}
                      disabled={updatingPassword}
                    >
                      {updatingPassword ? t('authRecoveryUpdating') : t('authRecoverySubmitBtn')}
                    </Button>

                    <div className="pt-2 text-center">
                      <button
                        type="button"
                        onClick={handleCancelRecovery}
                        className="text-xs text-stone-600 hover:text-copper transition-colors underline underline-offset-2 decoration-stone-300"
                      >
                        {t('authRecoveryBackToSignIn')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (

            <div className="border border-stone-300 bg-[#FAF7F2] p-5 sm:p-8 shadow-[0_12px_32px_rgba(23,25,22,0.06)] rounded-sm">
              {/* Animated Segmented Control */}
              <div
                role="tablist"
                aria-label="Authentication mode selection"
                className="relative flex items-center p-1 bg-stone-200/70 border border-stone-300/80 rounded-md mb-6 select-none"
              >
                {/* Sliding active indicator pill */}
                <div
                  className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded bg-ivory shadow-xs border border-stone-300/70 transition-transform duration-200 ease-out pointer-events-none"
                  style={{
                    transform: mode === 'sign_in' ? 'translateX(0)' : 'translateX(calc(100% + 4px))',
                  }}
                  aria-hidden="true"
                />

                {/* Sign In Tab */}
                <button
                  type="button"
                  role="tab"
                  id="tab-sign-in"
                  aria-selected={mode === 'sign_in'}
                  aria-controls="panel-auth-form"
                  onClick={() => switchMode('sign_in')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      switchMode('sign_in');
                    }
                  }}
                  className={`relative z-10 flex-1 py-2 text-xs font-mono font-medium uppercase tracking-wider text-center transition-all duration-150 rounded ${
                    mode === 'sign_in'
                      ? 'text-obsidian font-bold'
                      : 'text-stone-600 hover:text-obsidian hover:bg-stone-300/30'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper`}
                >
                  <span className="inline-block transition-transform duration-150 hover:-translate-y-px">
                    {t('authSignInTitle')}
                  </span>
                </button>

                {/* Create Workspace Tab */}
                <button
                  type="button"
                  role="tab"
                  id="tab-sign-up"
                  aria-selected={mode === 'sign_up'}
                  aria-controls="panel-auth-form"
                  onClick={() => switchMode('sign_up')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      switchMode('sign_up');
                    }
                  }}
                  className={`relative z-10 flex-1 py-2 text-xs font-mono font-medium uppercase tracking-wider text-center transition-all duration-150 rounded ${
                    mode === 'sign_up'
                      ? 'text-obsidian font-bold'
                      : 'text-stone-600 hover:text-obsidian hover:bg-stone-300/30'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper`}
                >
                  <span className="inline-block transition-transform duration-150 hover:-translate-y-px">
                    {t('authSignUpTitle')}
                  </span>
                </button>
              </div>

              {/* Form Title & Subtitle */}
              <div className="mb-6">
                <h2 className="font-serif text-2xl font-normal text-obsidian tracking-tight">
                  {mode === 'sign_in' ? t('authSignInTitle') : t('authSignUpTitle')}
                </h2>
                <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                  {mode === 'sign_in' ? t('authSignInSubtitle') : t('authSignUpSubtitle')}
                </p>
              </div>

              {!auth.configured ? (
                <div role="alert" className="space-y-3 text-sm text-copper-900 border-l-2 border-copper bg-copper-50 p-3">
                  <p className="font-medium">{supabaseConfigurationError}</p>
                  <p className="text-xs text-stone-600">
                    No local-only fallback is active here; configure Supabase to access saved workspace records.
                  </p>
                </div>
              ) : (
                <form id="panel-auth-form" onSubmit={submit} className="space-y-4">
                  {mode === 'sign_up' && (
                    <div className="space-y-4 transition-opacity duration-200">
                      <Input
                        label={t('authUsernameLabel')}
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        required
                        minLength={3}
                        maxLength={24}
                        helperText={t('authUsernameHint')}
                      />

                      <Input
                        label={t('authWorkspaceLabel')}
                        value={workspaceName}
                        onChange={(event) => setWorkspaceName(event.target.value)}
                        required
                        maxLength={120}
                        placeholder="e.g. Apex Media Global HQ"
                      />
                    </div>
                  )}

                  <Input
                    label={t('authEmailLabel')}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="editor@organization.com"
                  />

                  <div className="relative">
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="auth-password-input"
                        className="block text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-stone-700"
                      >
                        {t('authPasswordLabel')}
                      </label>
                      {mode === 'sign_in' && (
                        <button
                          type="button"
                          data-testid="forgot-password-btn"
                          onClick={handleForgotPassword}
                          disabled={resetSending || submitting}
                          className="text-[11px] font-mono text-copper hover:text-copper-700 font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-copper disabled:opacity-50"
                        >
                          {resetSending ? t('authForgotPasswordSending') : t('authForgotPasswordLink')}
                        </button>
                      )}
                    </div>
                    <Input
                      id="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••••••"
                      rightIcon={
                        <button
                          type="button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword(!showPassword)}
                          className="pointer-events-auto p-1 text-stone-400 hover:text-stone-700 focus-visible:outline-none focus-visible:text-copper transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      }
                    />
                  </div>

                  {(formError || auth.error) && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 border-l-2 border-copper bg-copper-50 p-3 text-xs text-copper-900"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 text-copper mt-0.5" />
                      <span>{formError || auth.error}</span>
                    </div>
                  )}

                  {feedback && (
                    <div
                      role="status"
                      className="flex items-start gap-2 border-l-2 border-forest bg-forest-50 p-3 text-xs text-forest-900"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-forest mt-0.5" />
                      <span>{feedback}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="copper"
                    size="md"
                    className="w-full justify-center mt-2"
                    isLoading={submitting}
                    disabled={submitting}
                  >
                    {mode === 'sign_in' ? t('authSignInBtn') : t('authSignUpBtn')}
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      className="text-xs text-stone-600 hover:text-copper transition-colors underline underline-offset-2 decoration-stone-300"
                      onClick={() => switchMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}
                    >
                      {mode === 'sign_in' ? t('authNeedAccount') : t('authAlreadyHaveAccount')}
                    </button>
                  </div>
                </form>
              )}
              {/* Judge & Evaluation Demo Mode Entry */}
              <div className="mt-4 pt-3.5 border-t border-stone-200/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    window.localStorage.setItem('brandlens.demo_mode', 'true');
                    navigate('/dashboard');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-mono text-copper hover:text-copper-700 font-semibold uppercase tracking-wider transition-colors hover:underline underline-offset-4"
                >
                  <span>{t('authContinueAsDemo')}</span>
                </button>
              </div>
            </div>
            )}

            {/* Security and isolation micro-footnote */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
              <Lock className="h-3 w-3 text-copper-600" />
              <span>{t('authSecurityBadge')}</span>
            </div>
          </div>

          {/* Footer Metadata */}
          <footer className="text-center text-[10px] font-mono text-stone-500 border-t border-stone-200/80 pt-4">
            BrandLens AI / Editorial Intelligence Studio &amp; Governance
          </footer>
        </div>
      </div>
    </div>
  );
};
