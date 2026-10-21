import React, { ReactNode } from 'react';
import { BadgeVariant, BadgeSize } from '@/types/common';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'stone',
  size = 'md',
  dot = false,
  icon,
  children,
  className = '',
}) => {
  const sizeStyles: Record<BadgeSize, string> = {
    sm: 'text-[10px] px-1.5 py-0.5 tracking-[0.12em]',
    md: 'text-[11px] px-2 py-1 tracking-[0.12em]',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    forest: 'bg-forest-50/90 text-forest-700 border border-forest-300/80',
    copper: 'bg-copper-50/90 text-copper-700 border border-copper-300/80',
    stone: 'bg-stone-100 text-stone-700 border border-stone-300',
    obsidian: 'bg-obsidian text-ivory border border-obsidian-700',
    neutral: 'bg-ivory-200/90 text-obsidian-800 border border-stone-300/80',
    outline: 'bg-transparent text-obsidian border border-stone-300',
  };

  const dotColorStyles: Record<BadgeVariant, string> = {
    forest: 'bg-forest',
    copper: 'bg-copper',
    stone: 'bg-stone-500',
    obsidian: 'bg-ivory',
    neutral: 'bg-obsidian-700',
    outline: 'bg-obsidian-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[2px] uppercase font-mono font-medium select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColorStyles[variant]}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="leading-none">{children}</span>
    </span>
  );
};

