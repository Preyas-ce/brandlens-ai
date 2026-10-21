import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-stone-700"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-stone-500">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-ivory-50 text-obsidian text-sm rounded-[3px] border border-stone-300 px-3 py-2 transition-colors duration-150 placeholder:text-stone-400 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/40 disabled:bg-stone-100 disabled:text-stone-400 ${
              leftIcon ? 'pl-9' : ''
            } ${rightIcon ? 'pr-9' : ''} ${
              error ? 'border-copper-600 focus:border-copper-600 focus:ring-copper-200' : ''
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-stone-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-[11px] text-copper-700 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-stone-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 font-sans">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-[10px] font-mono uppercase tracking-[0.14em] font-semibold text-stone-700"
          >
            {label}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`w-full bg-ivory-50 text-obsidian text-sm rounded-[3px] border border-stone-300 px-3 py-2.5 transition-colors duration-150 placeholder:text-stone-400 focus:outline-none focus:border-copper focus:ring-1 focus:ring-copper/40 disabled:bg-stone-100 disabled:text-stone-400 resize-y leading-relaxed ${
            error ? 'border-copper-600 focus:border-copper-600 focus:ring-copper-200' : ''
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-[11px] text-copper-700 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-stone-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

