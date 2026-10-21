import React, { ReactNode } from 'react';

export interface PanelProps {
  kicker?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
  variant?: 'canvas' | 'elevated' | 'bordered' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Panel: React.FC<PanelProps> = ({
  kicker,
  title,
  subtitle,
  headerAction,
  footer,
  children,
  className = '',
  id,
  variant = 'bordered',
  padding = 'md',
}) => {
  const variantStyles = {
    canvas: 'bg-ivory border border-stone-300/90 shadow-xs',
    elevated: 'bg-ivory-50/90 border border-stone-300/80 shadow-editorial',
    bordered: 'bg-ivory-50/60 border border-stone-300/80',
    subtle: 'bg-transparent border border-stone-200',
  };

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <div
      id={id}
      className={`rounded-[3px] overflow-hidden transition-colors duration-150 ${variantStyles[variant]} ${className}`}
    >
      {(kicker || title || headerAction || subtitle) && (
        <div className="px-5 md:px-6 py-4 border-b border-stone-200/90 flex flex-wrap items-center justify-between gap-3 bg-ivory-100/70">
          <div>
            {kicker && (
              <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold text-copper block mb-0.5">
                {kicker}
              </span>
            )}
            {title && (
              <h3 className="font-serif text-lg md:text-xl font-normal tracking-tight text-obsidian">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-stone-600 mt-0.5 font-sans leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && (
            <div className="flex items-center gap-2">
              {headerAction}
            </div>
          )}
        </div>
      )}

      <div className={paddingStyles[padding]}>
        {children}
      </div>

      {footer && (
        <div className="px-5 md:px-6 py-3 border-t border-stone-200/90 bg-ivory-100/50 text-xs text-stone-600">
          {footer}
        </div>
      )}
    </div>
  );
};
