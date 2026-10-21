import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileSearch, 
  BookOpen, 
  Activity,
  ShieldCheck, 
  History, 
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';
import { Brandmark } from '../brand/Brandmark';
import { NavItem, NavGroup } from '@/types/navigation';
import { Badge } from '../ui/Badge';
import { readReviewRecords, REVIEW_RECORDS_STORAGE_KEY, REVIEW_RECORDS_UPDATED_EVENT } from '@/services/reviewStorage';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'workbench',
    title: 'Editorial Workbench',
    items: [
      {
        id: 'dashboard',
        label: 'Overview',
        path: '/dashboard',
        icon: LayoutDashboard,
        description: 'Governance pulse & metrics',
      },
      {
        id: 'review',
        label: 'Content Workbench',
        path: '/review',
        icon: FileSearch,
        description: 'Heuristic analysis engine',
      },
    ],
  },
  {
    id: 'governance',
    title: 'Governance & Ledger',
    items: [
      {
        id: 'guidelines',
        label: 'Brand Guidelines',
        path: '/guidelines',
        icon: BookOpen,
        description: 'Voice directives & rules',
      },
      {
        id: 'approvals',
        label: 'Verification Gate',
        path: '/approvals',
        icon: ShieldCheck,
        badgeVariant: 'copper',
        description: 'Human sign-off queue',
      },
      {
        id: 'activity',
        label: 'Activity',
        path: '/activity',
        icon: Activity,
        description: 'Recent review events',
      },
      {
        id: 'history',
        label: 'Audit Records',
        path: '/history',
        icon: History,
        description: 'Local approval and workspace event history',
      },
    ],
  },
  {
    id: 'system',
    title: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings & Policy',
        path: '/settings',
        icon: Settings,
        description: 'Workspace enforcement thresholds',
      },
    ],
  },
];

// Flat list for lookup
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [queueLoadError, setQueueLoadError] = useState('');

  useEffect(() => {
    const refreshPendingCount = () => {
      try {
        setPendingReviewCount(readReviewRecords().filter((record) => record.status === 'awaiting_human_verification').length);
        setQueueLoadError('');
      } catch (error) {
        setQueueLoadError(error instanceof Error ? error.message : 'The local verification queue could not be loaded.');
      }
    };
    refreshPendingCount();
    window.addEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshPendingCount);
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REVIEW_RECORDS_STORAGE_KEY) refreshPendingCount();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(REVIEW_RECORDS_UPDATED_EVENT, refreshPendingCount);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Close on Escape when mobile menu is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    if (mobileOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-obsidian/80 backdrop-blur-[2px] md:hidden transition-opacity duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Main Vertical Sidebar */}
      <aside
        aria-label="Editorial Governance Navigation"
        className={`fixed md:sticky top-0 left-0 z-40 h-screen bg-obsidian text-ivory flex flex-col border-r border-obsidian-800 transition-all duration-200 select-none ${
          collapsed ? 'w-20' : 'w-64'
        } ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-obsidian-800 flex items-center justify-between shrink-0 bg-obsidian">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 rounded-[2px]"
            onClick={onCloseMobile}
          >
            <Brandmark collapsed={collapsed} size="md" theme="dark" />
          </NavLink>

          {/* Mobile close button */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="p-1.5 rounded-[2px] text-stone-400 hover:text-ivory hover:bg-obsidian-800 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 py-4 px-3 space-y-5 overflow-y-auto overflow-x-hidden">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="space-y-1">
              {/* Group Section Header */}
              {!collapsed ? (
                <div className="px-2 mb-1.5 text-[9px] uppercase font-mono font-semibold tracking-[0.2em] text-stone-500">
                  {group.title}
                </div>
              ) : (
                <div className="text-center text-stone-600 text-[10px] mb-1 font-mono">
                  —
                </div>
              )}

              {/* Group Nav Items */}
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge = item.id === 'approvals' && pendingReviewCount > 0
                  ? String(pendingReviewCount)
                  : item.badge;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 py-2 text-xs font-sans rounded-[2px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 ${
                        isActive
                          ? 'bg-obsidian-800/90 text-ivory font-medium border-l-[3px] border-copper pl-2.5 pr-3 shadow-xs'
                          : 'text-stone-300 hover:text-ivory hover:bg-obsidian-800/50 border-l-[3px] border-transparent pl-2.5 pr-3'
                      } ${collapsed ? 'justify-center !px-0 !border-l-0' : ''}`
                    }
                    onClick={onCloseMobile}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive
                              ? 'text-copper-400'
                              : 'text-stone-400 group-hover:text-stone-200'
                          } ${collapsed && isActive ? 'text-copper' : ''}`}
                        />
                        {!collapsed && (
                          <div className="flex-1 flex items-center justify-between truncate">
                            <span className="truncate">{item.label}</span>
                            {badge && (
                              <span
                                className={`ml-2 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-[2px] ${
                                  isActive
                                    ? 'bg-copper text-white'
                                    : 'bg-copper/20 text-copper-300 border border-copper/40'
                                }`}
                              >
                                {badge}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {queueLoadError && !collapsed && (
          <p role="alert" className="mx-3 mb-2 border-l-2 border-copper bg-obsidian-800 px-2 py-1.5 text-[9px] leading-relaxed text-copper-200">
            Verification count unavailable: {queueLoadError}
          </p>
        )}

        {/* Human Verification Gate Status Indicator & Engine Notice */}
        <div className="p-3 border-t border-obsidian-800 shrink-0 bg-obsidian">
          {!collapsed ? (
            <div className="bg-obsidian-800/90 rounded-[3px] p-3 border border-obsidian-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-copper" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-copper">
                    Human Gate Active
                  </span>
                </div>
                <Badge variant="forest" size="sm" dot>Enforced</Badge>
              </div>

              <p className="text-[11px] text-stone-400 leading-snug">
                AI evaluation is strictly advisory; publication requires a recorded human reviewer decision.
              </p>

              <div className="pt-2 border-t border-obsidian-700/60 flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-stone-500">
                <span>Deterministic v0.1</span>
                <span className="text-forest-300">Offline Safe</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1" title="Human Verification Gate: Active (Deterministic Local Mode)">
              <span className="w-2.5 h-2.5 rounded-full bg-copper ring-4 ring-copper/20 animate-pulse" />
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar navigation' : 'Collapse sidebar navigation'}
            className="hidden md:flex mt-2.5 w-full items-center justify-center gap-2 py-1.5 rounded-[2px] text-xs text-stone-400 hover:text-ivory hover:bg-obsidian-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                  Collapse Sidebar
                </span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
