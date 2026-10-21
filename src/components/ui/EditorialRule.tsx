import React from 'react';

export interface EditorialRuleProps {
  variant?: 'stone' | 'copper' | 'subtle';
  withMark?: boolean;
  className?: string;
}

export const EditorialRule: React.FC<EditorialRuleProps> = ({
  variant = 'stone',
  withMark = false,
  className = '',
}) => {
  const lineClasses = {
    stone: 'border-stone-300/80',
    copper: 'border-copper/40',
    subtle: 'border-stone-200/60',
  };

  if (!withMark) {
    return <hr className={`border-t ${lineClasses[variant]} my-4 ${className}`} />;
  }

  return (
    <div className={`relative flex items-center justify-center my-6 ${className}`}>
      <div className={`flex-1 border-t ${lineClasses[variant]}`} />
      <div className="mx-3 flex items-center gap-1.5 px-2 bg-ivory">
        <span className="w-1.5 h-1.5 rotate-45 bg-copper" />
        <span className="text-[9px] uppercase font-mono tracking-[0.25em] text-stone-500 font-semibold">
          BrandLens
        </span>
        <span className="w-1.5 h-1.5 rotate-45 bg-forest" />
      </div>
      <div className={`flex-1 border-t ${lineClasses[variant]}`} />
    </div>
  );
};
