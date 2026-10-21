import React, { ReactNode } from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  kicker?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  kicker = 'RECORD DIRECTORY',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`p-10 md:p-14 text-center rounded-[3px] border border-stone-300/80 bg-ivory-50/70 space-y-4 max-w-xl mx-auto my-6 ${className}`}
    >
      {/* Icon Frame */}
      {icon ? (
        <div className="w-12 h-12 mx-auto rounded-[2px] bg-ivory-100 border border-stone-300 flex items-center justify-center text-copper shadow-xs">
          {icon}
        </div>
      ) : (
        <div className="w-12 h-12 mx-auto rounded-[2px] bg-ivory-100 border border-stone-300 flex items-center justify-center text-copper shadow-xs">
          {/* Default Optical reticle SVG */}
          <svg className="w-6 h-6 text-stone-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3" strokeWidth="1.5" className="text-copper" />
            <line x1="12" y1="3" x2="12" y2="7" strokeWidth="1.5" />
            <line x1="12" y1="17" x2="12" y2="21" strokeWidth="1.5" />
            <line x1="3" y1="12" x2="7" y2="12" strokeWidth="1.5" />
            <line x1="17" y1="12" x2="21" y2="12" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Editorial Headline & Kicker */}
      <div className="space-y-1.5">
        {kicker && (
          <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold text-copper block">
            {kicker}
          </span>
        )}
        <h3 className="font-serif text-xl md:text-2xl font-normal text-obsidian tracking-tight">
          {title}
        </h3>
        <p className="text-xs md:text-sm text-stone-600 leading-relaxed max-w-md mx-auto">
          {description}
        </p>
      </div>

      {/* Action buttons */}
      {(action || secondaryAction) && (
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={action.icon}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              size="sm"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
