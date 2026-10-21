import React, { useEffect, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  kicker?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  kicker,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = previousOverflow;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Editorial backdrop overlay */}
      <div
        className="fixed inset-0 bg-obsidian/75 backdrop-blur-[2px] transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[90vh] w-full flex-col ${maxWidthStyles[maxWidth]} bg-ivory rounded-[3px] border border-stone-300 shadow-modal z-10 overflow-hidden transform transition-all duration-200`}
      >
        {/* Fine copper aperture highlight rule */}
        <div className="h-[2px] bg-copper w-full" />

        {/* Header */}
        {(title || subtitle || kicker) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200/90 bg-ivory-100/80 px-6 py-4">
            <div>
              {kicker && (
                <span className="text-[10px] uppercase font-mono tracking-[0.2em] font-bold text-copper block mb-0.5">
                  {kicker}
                </span>
              )}
              {title && (
                <h3 className="font-serif text-xl font-normal text-obsidian tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-stone-600 mt-0.5 font-sans leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1 rounded-[2px] text-stone-500 hover:text-obsidian hover:bg-stone-200/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Optional Footer */}
        {footer !== undefined ? (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-stone-200/90 bg-ivory-100/60 px-6 py-3.5">
            {footer}
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-stone-200/90 bg-ivory-100/60 px-6 py-3.5">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Dismiss
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
