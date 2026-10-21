import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { ButtonVariant, ButtonSize } from '@/types/common';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-sans font-medium transition duration-150 hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/60 focus-visible:ring-offset-1 focus-visible:ring-offset-ivory active:translate-y-0 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none select-none';

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 rounded-[3px] gap-1.5',
    md: 'text-xs md:text-sm px-4 py-2 rounded-[3px] gap-2',
    lg: 'text-sm md:text-base px-5 py-2.5 rounded-[3px] gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-obsidian text-ivory hover:bg-obsidian-800 shadow-xs border border-obsidian-700',
    secondary: 'bg-ivory-100 text-obsidian hover:bg-ivory-300 border border-stone-300 shadow-xs',
    copper: 'bg-copper text-white hover:bg-copper-600 shadow-xs border border-copper-600',
    forest: 'bg-forest text-white hover:bg-forest-500 shadow-xs border border-forest-700',
    ghost: 'text-obsidian hover:bg-stone-200/50 hover:text-obsidian-950 bg-transparent',
    outline: 'border border-stone-300 text-obsidian hover:border-obsidian hover:bg-ivory-100 bg-transparent',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
