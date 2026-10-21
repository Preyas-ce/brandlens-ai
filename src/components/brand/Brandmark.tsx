import React from 'react';

export interface BrandmarkProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'dark' | 'light';
  showSubtitle?: boolean;
}

export const Brandmark: React.FC<BrandmarkProps> = ({ 
  collapsed = false, 
  className = '',
  size = 'md',
  theme = 'dark',
  showSubtitle = true
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Precision Geometric Brand Lens Icon */}
      <div className={`relative ${iconSizes[size]} shrink-0 flex items-center justify-center`}>
        <svg
          viewBox="0 0 40 40"
          className="w-full h-full drop-shadow-sm transition-transform duration-300 hover:rotate-45"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Base obsidian lens chamber */}
          <circle cx="20" cy="20" r="18" fill="#171916" stroke={isDark ? '#2E322C' : '#171916'} strokeWidth="1" />
          
          {/* Precision calibration crosshair reticle */}
          <line x1="20" y1="4" x2="20" y2="9" stroke="#A8A095" strokeWidth="1.25" strokeLinecap="round" />
          <line x1="20" y1="31" x2="20" y2="36" stroke="#A8A095" strokeWidth="1.25" strokeLinecap="round" />
          <line x1="4" y1="20" x2="9" y2="20" stroke="#A8A095" strokeWidth="1.25" strokeLinecap="round" />
          <line x1="31" y1="20" x2="36" y2="20" stroke="#A8A095" strokeWidth="1.25" strokeLinecap="round" />
          
          {/* Copper calibrated optical aperture ring */}
          <circle cx="20" cy="20" r="11" stroke="#BC744E" strokeWidth="1.5" strokeDasharray="3 2" />
          
          {/* Editorial diamond verification focal point in Forest Green */}
          <rect
            x="16.5"
            y="16.5"
            width="7"
            height="7"
            transform="rotate(45 20 20)"
            fill="#244C3A"
            stroke="#F6F1E8"
            strokeWidth="1.2"
          />

          {/* Central optical core */}
          <circle cx="20" cy="20" r="1.5" fill="#BC744E" />
        </svg>
      </div>

      {!collapsed && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className={`font-serif tracking-tight font-medium ${
                isDark ? 'text-ivory' : 'text-obsidian'
              } ${textSizes[size]}`}
            >
              Brand<span className={`italic font-normal ${isDark ? 'text-ivory-300' : 'text-obsidian-700'}`}>Lens</span>
            </span>
            <span
              className={`text-[9px] font-mono font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-[2px] ${
                isDark
                  ? 'bg-copper/25 text-copper-200 border border-copper/40'
                  : 'bg-copper/15 text-copper-700 border border-copper/30'
              }`}
            >
              AI
            </span>
          </div>
          {showSubtitle && (
            <span
              className={`text-[9px] uppercase font-mono tracking-[0.2em] font-medium mt-1 ${
                isDark ? 'text-stone-400' : 'text-stone-600'
              }`}
            >
              Editorial Intelligence
            </span>
          )}
        </div>
      )}
    </div>
  );
};

