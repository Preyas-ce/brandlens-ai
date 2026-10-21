import { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: 'forest' | 'copper' | 'stone';
  description?: string;
  section?: 'workbench' | 'governance' | 'system';
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export interface WorkspaceOption {
  id: string;
  name: string;
  division: string;
  region: string;
  isDefault?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  summary: string;
  category: 'gate' | 'directive' | 'audit';
  time: string;
  read: boolean;
  linkPath?: string;
}
