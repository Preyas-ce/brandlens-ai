import React from 'react';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { IssueSeverity } from '@/types/governance';

export interface SeverityIndicatorProps {
  severity: IssueSeverity | 'verified' | 'compliant';
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const SeverityIndicator: React.FC<SeverityIndicatorProps> = ({
  severity,
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const configs = {
    critical: {
      label: 'Critical Flag',
      icon: AlertOctagon,
      badgeClass: 'bg-copper-50 text-copper-800 border-copper-300',
      iconClass: 'text-copper-700',
    },
    warning: {
      label: 'Warning',
      icon: AlertTriangle,
      badgeClass: 'bg-ivory-100 text-copper-800 border-copper-200',
      iconClass: 'text-copper',
    },
    advisory: {
      label: 'Advisory Note',
      icon: Info,
      badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
      iconClass: 'text-stone-500',
    },
    verified: {
      label: 'Verified',
      icon: CheckCircle2,
      badgeClass: 'bg-forest-50 text-forest-700 border-forest-300',
      iconClass: 'text-forest',
    },
    compliant: {
      label: 'Compliant',
      icon: CheckCircle2,
      badgeClass: 'bg-forest-50 text-forest-700 border-forest-300',
      iconClass: 'text-forest',
    },
  };

  const config = configs[severity] || configs.advisory;
  const Icon = config.icon;

  const sizeClass = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0.5 gap-1' 
    : 'text-[11px] px-2 py-1 gap-1.5';

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center rounded-[2px] border uppercase font-mono font-medium tracking-[0.1em] select-none ${config.badgeClass} ${sizeClass} ${className}`}
    >
      <Icon className={`${iconSize} ${config.iconClass} shrink-0`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};
