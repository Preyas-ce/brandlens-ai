import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  Search, 
  Sparkles, 
  HelpCircle,
  Building2,
  Bell,
  ChevronDown,
  UserCheck,
  ShieldCheck,
  ExternalLink,
  FileSearch,
  Clock,
  Settings as SettingsIcon,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { NAV_GROUPS, NAV_ITEMS } from './Sidebar';
import { NotificationItem } from '@/types/navigation';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  readWorkspaceSettings,
  WORKSPACE_DATA_STORAGE_KEY,
  WORKSPACE_DATA_UPDATED_EVENT,
} from '@/services/workspaceStorage';
import { WorkspaceSettings } from '@/types/workspace';
import { analyzeLocalContent, LocalReviewAnalysis } from '@/services/localReviewEngine';
import { QUICK_SCAN_OPEN_EVENT } from '@/services/uiPreferences';

interface TopBarProps {
  onOpenMobileSidebar: () => void;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Awaiting Human Verification Gate',
    summary: 'Seeded example DOC-904 contains 3 policy flags requiring demo reviewer attention.',
    category: 'gate',
    time: '12m ago',
    read: false,
    linkPath: '/approvals',
  },
  {
    id: 'notif-2',
    title: 'Brand Guideline Rule Modified',
    summary: 'Rule R-102 (Wordmark Capitalization) revised by Elena Rostova.',
    category: 'directive',
    time: '1h ago',
    read: false,
    linkPath: '/guidelines',
  },
  {
    id: 'notif-3',
    title: 'Publication Cleared & Signed',
    summary: 'Seeded example DOC-901 approved; a decision record appears in the local demo history.',
    category: 'audit',
    time: '4h ago',
    read: true,
    linkPath: '/history',
  },
];

const QUICK_SCAN_SAMPLES = [
  {
    id: 'brand-safe',
    title: 'A · Brand-safe',
    description: 'Clear, helpful language without unsupported promises.',
    content: "Discover a simpler way to organise your team's work. Explore practical features and find the approach that fits your needs.",
  },
  {
    id: 'numerical-claim',
    title: 'B · Numerical claim',
    description: 'A quantified performance claim with no supporting evidence.',
    content: 'Our platform makes every team 10x more productive in just 7 days.',
  },
  {
    id: 'absolute-guarantee',
    title: 'C · Absolute guarantee',
    description: 'Absolute outcomes and zero-risk language to review.',
    content: 'Our revolutionary platform guarantees perfect results for every customer, with zero risk and no possibility of failure.',
  },
  {
    id: 'mixed-signals',
    title: 'D · Mixed signals',
    description: 'A risky sample combining superlatives, guarantees, and jargon.',
    content: 'Our revolutionary, best-in-class platform guarantees 100% brand synergy without compromise.',
  },
] as const;

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown states
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [workspaceError, setWorkspaceError] = useState('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAvatarOpen, setIsAvatarOpen] = useState(false);
  const [isGovernanceMenuOpen, setIsGovernanceMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // Modals
  const [isEngineModalOpen, setIsEngineModalOpen] = useState(false);
  const [isQuickScanModalOpen, setIsQuickScanModalOpen] = useState(false);
  const [quickScanText, setQuickScanText] = useState('');
  const [quickScanResult, setQuickScanResult] = useState<LocalReviewAnalysis | null>(null);
  const [quickScanError, setQuickScanError] = useState('');

  // Refs for click outside
  const workspaceRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const governanceRef = useRef<HTMLDivElement>(null);
  const activeWorkspace = {
    name: workspaceSettings.workspaceName,
    division: workspaceSettings.demoBrandName,
    region: 'Local browser workspace',
  };
  const reviewerInitials = workspaceSettings.reviewerDisplayName
    .split(/\s+/)
    .filter((part) => part && !part.startsWith('('))
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  // Close dropdowns on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (workspaceRef.current && !workspaceRef.current.contains(target)) {
        setIsWorkspaceOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setIsNotificationsOpen(false);
      }
      if (avatarRef.current && !avatarRef.current.contains(target)) {
        setIsAvatarOpen(false);
      }
      if (governanceRef.current && !governanceRef.current.contains(target)) {
        setIsGovernanceMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWorkspaceOpen(false);
        setIsNotificationsOpen(false);
        setIsAvatarOpen(false);
        setIsGovernanceMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const openQuickScan = () => {
      setQuickScanResult(null);
      setQuickScanError('');
      setIsQuickScanModalOpen(true);
    };
    window.addEventListener(QUICK_SCAN_OPEN_EVENT, openQuickScan);
    return () => window.removeEventListener(QUICK_SCAN_OPEN_EVENT, openQuickScan);
  }, []);

  useEffect(() => {
    const refreshSettings = () => {
      try {
        setWorkspaceSettings(readWorkspaceSettings());
        setWorkspaceError('');
      } catch (error) {
        setWorkspaceError(error instanceof Error ? error.message : 'Workspace settings could not be loaded.');
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

  // Determine current route title
  const currentNav = NAV_ITEMS.find((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));
  const pageTitle = currentNav ? currentNav.label : location.pathname === '/' ? 'Overview' : 'Editorial Governance';
  const currentGroup = NAV_GROUPS.find((group) => group.items.some((item) => item.id === currentNav?.id));
  const isGovernanceRoute = currentGroup?.id === 'governance';
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickScanText.trim()) {
      setQuickScanResult(null);
      setQuickScanError('Enter a snippet before running a local scan.');
      return;
    }

    setQuickScanError('');
    setQuickScanResult(null);
    try {
      const analysis = analyzeLocalContent(quickScanText);
      setQuickScanResult(analysis);
    } catch (error) {
      setQuickScanError(`The local scan could not run: ${error instanceof Error ? error.message : 'workspace rules are unavailable.'}`);
    }
  };

  return (
    <>
      <header
        role="banner"
        className="h-16 bg-ivory/95 border-b border-stone-300/90 px-3 sm:px-4 md:px-8 flex items-center justify-between gap-2 md:gap-4 sticky top-0 z-30 backdrop-blur-xs select-none transition-colors"
      >
        {/* Left: Mobile Toggle & Page Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation menu"
            className="md:hidden p-1.5 rounded-[2px] text-obsidian hover:bg-stone-200/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            <Menu className="w-5 h-5" />
          </button>

          <nav aria-label="Breadcrumb" className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 leading-none">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hidden rounded-sm text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-stone-500 transition-colors hover:text-copper hover:underline hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 sm:block"
            >
              Editorial Directory
            </button>
            <ChevronRight className="hidden h-3 w-3 text-stone-400 sm:block" aria-hidden="true" />
            {isGovernanceRoute && (
              <>
                <div className="relative hidden sm:block" ref={governanceRef}>
                  <button
                    type="button"
                    aria-expanded={isGovernanceMenuOpen}
                    onClick={() => setIsGovernanceMenuOpen((open) => !open)}
                    className="rounded-sm text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-stone-500 transition-colors hover:text-copper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
                  >
                    Governance &amp; Ledger
                  </button>
                  {isGovernanceMenuOpen && (
                    <div className="absolute left-0 top-[calc(100%+0.7rem)] z-50 min-w-48 border border-stone-300 bg-ivory p-1.5 shadow-lg">
                      {NAV_GROUPS.find((group) => group.id === 'governance')?.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            navigate(item.path);
                            setIsGovernanceMenuOpen(false);
                          }}
                          className={`block w-full px-2.5 py-2 text-left text-xs transition-colors hover:bg-ivory-100 hover:text-copper ${item.id === currentNav?.id ? 'font-semibold text-obsidian' : 'text-stone-600'}`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="hidden h-3 w-3 text-stone-400 sm:block" aria-hidden="true" />
              </>
            )}
            <h1 className="max-w-28 truncate font-serif text-base text-obsidian tracking-tight sm:max-w-none sm:text-lg md:text-xl">
              {pageTitle}
            </h1>
            {workspaceError && <span role="alert" title={workspaceError} className="text-[8px] font-mono uppercase tracking-wider text-copper-800">Workspace data unavailable</span>}
          </nav>
        </div>

        {/* Center: Search input */}
        <div className="hidden 2xl:flex items-center flex-1 max-w-48 2xl:max-w-sm mx-4">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search guidelines, rules, or audit queue..."
              className="w-full bg-ivory-50/80 text-obsidian text-xs rounded-[3px] border border-stone-300/80 pl-9 pr-7 py-1.5 placeholder:text-stone-400 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-obsidian text-[11px] font-mono"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Workspace selector, Gate badge, Notifications, Engine Info, Avatar */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {/* Workspace Selector Dropdown */}
          <div className="relative" ref={workspaceRef}>
            <button
              onClick={() => {
                setIsWorkspaceOpen(!isWorkspaceOpen);
                setIsNotificationsOpen(false);
                setIsAvatarOpen(false);
              }}
              aria-expanded={isWorkspaceOpen}
              aria-label="Select active editorial workspace"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[3px] bg-ivory-100 border border-stone-300/80 text-xs text-obsidian hover:bg-stone-200/50 hover:border-stone-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <Building2 className="w-3.5 h-3.5 text-copper shrink-0" />
              <div className="text-left hidden sm:block">
                <span className="font-medium text-xs text-obsidian leading-none block">
                  {activeWorkspace.name}
                </span>
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider block mt-0.5">
                  {activeWorkspace.region}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-stone-500 ml-0.5" />
            </button>

            {/* Workspace Dropdown Menu */}
            {isWorkspaceOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-ivory rounded-[3px] border border-stone-300 shadow-modal z-50 overflow-hidden py-1 divide-y divide-stone-200">
                <div className="px-3.5 py-2 bg-ivory-100/70">
                  <span className="text-[9px] uppercase font-mono tracking-[0.2em] font-bold text-copper block">
                    Local demo workspace
                  </span>
                  <p className="text-[11px] text-stone-600">
                    Workspace identity and brand details are configured in Settings.
                  </p>
                </div>

                <div className="py-1">
                  <div className="px-3.5 py-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-obsidian">{activeWorkspace.name}</span>
                      <Badge variant="stone" size="sm">Local</Badge>
                    </div>
                    <div className="mt-0.5 text-[10px] text-stone-500">{activeWorkspace.division}</div>
                  </div>
                </div>

                <div className="px-3.5 py-2 bg-ivory-100/50 flex items-center justify-between">
                  <span className="text-[10px] text-stone-500 font-mono">
                    Browser-local prototype
                  </span>
                  <button
                    onClick={() => {
                      setIsWorkspaceOpen(false);
                      navigate('/settings');
                    }}
                    className="text-[11px] text-copper hover:text-copper-700 font-medium inline-flex items-center gap-1"
                  >
                    <span>Manage</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verification Gate Badge */}
          <div className="hidden 2xl:flex items-center">
            <Badge variant="forest" size="sm" dot>
              Gate Enforced
            </Badge>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsWorkspaceOpen(false);
                setIsAvatarOpen(false);
              }}
              aria-expanded={isNotificationsOpen}
              aria-label={`Editorial notifications (${unreadCount} unread)`}
              className="p-2 rounded-[3px] text-stone-600 hover:text-obsidian hover:bg-stone-200/50 transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-copper ring-2 ring-ivory" />
              )}
            </button>

            {/* Notifications Popover */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-ivory rounded-[3px] border border-stone-300 shadow-modal z-50 overflow-hidden divide-y divide-stone-200">
                <div className="px-4 py-2.5 bg-ivory-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-sm font-medium text-obsidian">
                      Editorial Notifications
                    </span>
                    {unreadCount > 0 && (
                      <Badge variant="copper" size="sm">{unreadCount} New</Badge>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] uppercase font-mono text-stone-600 hover:text-obsidian tracking-wider"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-stone-200/80">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (notif.linkPath) {
                          navigate(notif.linkPath);
                          setIsNotificationsOpen(false);
                        }
                      }}
                      className={`p-3.5 text-xs transition-colors cursor-pointer hover:bg-ivory-100 ${
                        !notif.read ? 'bg-ivory-50/80' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {!notif.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-copper shrink-0" />
                          )}
                          <span className="font-semibold text-obsidian">{notif.title}</span>
                        </div>
                        <span className="text-[10px] text-stone-500 font-mono shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {notif.time}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                        {notif.summary}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="px-4 py-2 bg-ivory-100/50 flex items-center justify-between text-xs">
                  <button
                    onClick={() => {
                      setIsNotificationsOpen(false);
                      navigate('/history');
                    }}
                    className="text-stone-600 hover:text-obsidian text-[11px] font-sans"
                  >
                    View audit ledger history
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsNotificationsOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Engine Disclaimer / Transparency Info Trigger */}
          <button
            onClick={() => setIsEngineModalOpen(true)}
            aria-label="Engine transparency specifications"
            title="Analysis Engine Disclosure"
            className="hidden sm:block p-2 rounded-[3px] text-stone-600 hover:text-obsidian hover:bg-stone-200/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Quick Scan Action */}
          <div className="hidden sm:block">
            <Button
              variant="copper"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              aria-label="Open Quick Scan"
              onClick={() => {
                setQuickScanResult(null);
                setQuickScanError('');
                setIsQuickScanModalOpen(true);
              }}
            >
              Quick Scan
            </Button>
          </div>

          {/* User Reviewer Avatar & Menu */}
          <div className="relative pl-1 border-l border-stone-300" ref={avatarRef}>
            <button
              onClick={() => {
                setIsAvatarOpen(!isAvatarOpen);
                setIsWorkspaceOpen(false);
                setIsNotificationsOpen(false);
              }}
              aria-expanded={isAvatarOpen}
              aria-label="Demo reviewer profile"
              className="flex items-center gap-2 p-1 rounded-[3px] hover:bg-stone-200/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <div className="relative w-8 h-8 rounded-[2px] bg-obsidian text-ivory flex items-center justify-center font-mono font-bold text-xs border border-obsidian-700 shadow-xs">
                <span>{reviewerInitials || 'DR'}</span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-stone-500 border-2 border-ivory" title="Demo reviewer identity" />
              </div>
            </button>

            {/* Avatar Dropdown Menu */}
            {isAvatarOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-ivory rounded-[3px] border border-stone-300 shadow-modal z-50 overflow-hidden divide-y divide-stone-200">
                <div className="p-4 bg-ivory-100/90 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-base font-medium text-obsidian">
                      {workspaceSettings.reviewerDisplayName}
                    </span>
                    <Badge variant="stone" size="sm" dot>Demo identity</Badge>
                  </div>
                  <p className="text-xs text-stone-600 font-sans">
                    Local prototype reviewer · not authenticated
                  </p>
                  <div className="pt-2">
                    <div className="p-2 rounded-[2px] bg-white border border-stone-200 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1 text-copper font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>                        Demo reviewer identity</span>
                      </div>
                      <p className="text-stone-500 text-[10px]">
                        Future decisions are recorded under this configured display name.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => {
                      setIsAvatarOpen(false);
                      setIsEngineModalOpen(true);
                    }}
                    className="sm:hidden w-full text-left px-4 py-2 text-xs text-stone-700 hover:text-obsidian hover:bg-ivory-100 flex items-center gap-2"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                    <span>Engine Transparency</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAvatarOpen(false);
                      setQuickScanResult(null);
                      setQuickScanError('');
                      setIsQuickScanModalOpen(true);
                    }}
                    className="sm:hidden w-full text-left px-4 py-2 text-xs text-stone-700 hover:text-obsidian hover:bg-ivory-100 flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-copper" />
                    <span>Quick Scan</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAvatarOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-stone-700 hover:text-obsidian hover:bg-ivory-100 flex items-center gap-2"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-stone-500" />
                    <span>Workspace Governance Settings</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsAvatarOpen(false);
                      navigate('/approvals');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-stone-700 hover:text-obsidian hover:bg-ivory-100 flex items-center gap-2"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-copper" />
                    <span>Open Verification Queue</span>
                  </button>
                </div>

                <div className="p-3 bg-ivory-100/50 flex items-center justify-between text-[11px] text-stone-500 font-mono">
                  <span>Session: Local Workspace</span>
                  <span className="text-stone-600 font-semibold">Local only</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Engine Transparency Modal */}
      <Modal
        isOpen={isEngineModalOpen}
        onClose={() => setIsEngineModalOpen(false)}
        kicker="ARCHITECTURAL DISCLOSURE"
        title="Engine Transparency & Capabilities"
        subtitle="Operational architecture of BrandLens AI local analysis engine"
        maxWidth="lg"
      >
        <div className="space-y-4 font-sans text-sm text-obsidian-700">
          <div className="p-3 bg-stone-100 rounded-[2px] border border-stone-200">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-obsidian mb-1">
              Local Heuristic & Deterministic Engine
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              BrandLens AI is configured to operate in-browser with zero paid external APIs or cloud dependencies. Rule matching, keyword detection, and voice consistency metrics run deterministically on your machine.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-xs uppercase tracking-wider text-obsidian mb-1.5">
              Human Verification Gate Protocol
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              In accordance with our core design philosophy, AI evaluations serve as advisory evidence. Content cannot be marked as approved or published without explicit sign-off from a credentialed human reviewer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-2.5 rounded-[2px] bg-ivory-100 border border-stone-200">
              <span className="text-[10px] uppercase font-bold text-stone-500 font-mono block">Persistence</span>
              <span className="text-xs font-medium text-obsidian">Browser LocalStorage</span>
            </div>
            <div className="p-2.5 rounded-[2px] bg-ivory-100 border border-stone-200">
              <span className="text-[10px] uppercase font-bold text-stone-500 font-mono block">Network Traffic</span>
              <span className="text-xs font-semibold text-forest">Zero / 100% Offline Capable</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Scan Modal */}
      <Modal
        isOpen={isQuickScanModalOpen}
        onClose={() => setIsQuickScanModalOpen(false)}
        kicker="PRE-FLIGHT CHECK"
        title="Quick Heuristic Scan"
        subtitle="Inspect a snippet against active local guidelines and the current evidence catalogue."
        maxWidth="lg"
      >
        <form onSubmit={handleQuickScan} className="space-y-4">
          <p role="note" className="border-l-4 border-copper bg-copper-50 px-3 py-2.5 text-xs font-semibold leading-relaxed text-copper-900">
            Preview only: Running a Quick Heuristic Scan checks snippet text in memory and does not create a saved review record, audit event, or human approval request.
          </p>
          <div>
            <label htmlFor="quick-scan-text" className="mb-1.5 block text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-stone-700">
              Sample Text or Headline
            </label>
            <textarea
              id="quick-scan-text"
              rows={4}
              value={quickScanText}
              onChange={(e) => {
                setQuickScanText(e.target.value);
                setQuickScanResult(null);
                setQuickScanError('');
              }}
              placeholder="Paste a headline, claim, or slogan (e.g. 'Our revolutionary, best in class AI guarantees 100% synergy')..."
              aria-describedby="quick-scan-disclosure"
              className="w-full resize-y rounded-[3px] border border-stone-300 bg-ivory-50 p-3 text-sm text-left leading-relaxed text-obsidian placeholder:text-stone-400 focus:border-copper focus:outline-none focus:ring-1 focus:ring-copper/40"
            />
            <p id="quick-scan-disclosure" className="mt-1.5 text-[10px] leading-relaxed text-stone-500">
              Samples only fill this editable field. Findings and scores are calculated when you run the local analysis.
            </p>
          </div>

          <section aria-label="Selectable Quick Scan examples">
            <p className="mb-2 text-[9px] font-mono font-bold uppercase tracking-wider text-stone-500">Learn with an example</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK_SCAN_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  aria-pressed={quickScanText === sample.content}
                  onClick={() => {
                    setQuickScanText(sample.content);
                    setQuickScanResult(null);
                    setQuickScanError('');
                  }}
                  className={`rounded-[3px] border p-3 text-left transition duration-150 hover:-translate-y-px hover:border-copper hover:bg-ivory-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 active:scale-[0.99] ${quickScanText === sample.content ? 'border-copper bg-copper-50/70' : 'border-stone-300 bg-ivory-50'}`}
                >
                  <span className="block text-[10px] font-semibold text-obsidian">{sample.title}</span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-stone-600">{sample.description}</span>
                </button>
              ))}
            </div>
          </section>

          {quickScanError && (
            <p role="alert" className="border-l-2 border-copper bg-copper-50 px-3 py-2 text-xs text-copper-900">{quickScanError}</p>
          )}

          {quickScanResult && (
            <div className={`rounded-[2px] border p-3 text-xs font-sans ${
              quickScanResult.findings.length === 0
                ? 'border-forest-300 bg-forest-50 text-forest-800'
                : 'border-copper-300 bg-copper-50 text-copper-800'
            }`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="font-semibold">
                  {quickScanResult.findings.length} finding{quickScanResult.findings.length === 1 ? '' : 's'}
                </strong>
                <span className="font-mono">Score {quickScanResult.score}/100</span>
              </div>
              <p className="mt-1 leading-relaxed">{quickScanResult.summary}</p>
              {quickScanResult.findings.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-current/20 pt-2">
                  {quickScanResult.findings.map((finding) => (
                    <li key={finding.id} className="min-w-0">
                      <p className="break-words font-semibold">{finding.ruleTitle}</p>
                      <p className="mt-0.5 break-words leading-relaxed">“{finding.quote}” — {finding.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 border-t border-current/20 pt-2 text-[10px] leading-relaxed">
                Calculated locally from the submitted text using active workspace rules; no sample result is prewritten.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsQuickScanModalOpen(false)}
              >
                Close
              </Button>
              <Button
                type="submit"
                variant="copper"
                size="sm"
                leftIcon={<FileSearch className="w-3.5 h-3.5" />}
              >
                Analyze Snippet
              </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};
