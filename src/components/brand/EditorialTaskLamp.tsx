import React, { useState } from 'react';

export interface EditorialTaskLampProps {
  isLit?: boolean;
  interactive?: boolean;
  onPull?: () => void;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
  idPrefix?: string;
  showReflection?: boolean;
}

export const EditorialTaskLamp: React.FC<EditorialTaskLampProps> = ({
  isLit = true,
  interactive = false,
  onPull,
  className = '',
  ariaLabel = 'BrandLens AI architectural editorial table lamp',
  idPrefix = 'editorial-lamp',
  showReflection = true,
}) => {
  const [internalLit, setInternalLit] = useState(isLit);

  const activeLit = onPull ? isLit : internalLit;

  const handlePull = () => {
    if (onPull) {
      onPull();
    } else if (interactive) {
      setInternalLit((current) => !current);
    }
  };

  const metalGrad = `${idPrefix}-metal`;
  const shadeGrad = `${idPrefix}-shade`;
  const shadeInnerGrad = `${idPrefix}-shade-inner`;
  const brassGrad = `${idPrefix}-brass`;
  const bulbGrad = `${idPrefix}-bulb`;
  const beamGrad = `${idPrefix}-beam`;

  return (
    <div
      className={`lamp-illustration relative aspect-square w-full select-none ${className} ${activeLit ? 'lamp-is-lit' : 'lamp-is-dim'}`}
      data-lit={activeLit}
    >
      {showReflection && (
        <div
          className={`illumination-reflection pointer-events-none absolute inset-x-[15%] bottom-[6%] h-[14%] rounded-full blur-2xl transition-colors duration-700 ${
            activeLit ? 'bg-copper/25' : 'bg-copper/0'
          }`}
          aria-hidden="true"
        />
      )}

      <svg
        viewBox="0 0 360 400"
        className="absolute inset-0 h-full w-full drop-shadow-[0_16px_20px_rgba(0,0,0,0.36)]"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          {/* Turned dark walnut / obsidian pedestal & column gradient */}
          <linearGradient id={metalGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a1c18" />
            <stop offset="30%" stopColor="#31332c" />
            <stop offset="60%" stopColor="#1d1f1a" />
            <stop offset="100%" stopColor="#121310" />
          </linearGradient>

          {/* Deep Forest Green architectural shade gradient */}
          <linearGradient id={shadeGrad} x1="0" y1="0" x2="1" y2="0.3">
            <stop offset="0%" stopColor="#143023" />
            <stop offset="35%" stopColor="#244c3a" />
            <stop offset="70%" stopColor="#1b3c2d" />
            <stop offset="100%" stopColor="#12281d" />
          </linearGradient>

          {/* Warm internal shade translucency */}
          <linearGradient id={shadeInnerGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff2d1" stopOpacity="0.4" />
            <stop offset="60%" stopColor="#f4cf91" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#bc744e" stopOpacity="0.1" />
          </linearGradient>

          {/* Polished brushed brass rings & finials */}
          <linearGradient id={brassGrad} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a5538" />
            <stop offset="35%" stopColor="#e3ba83" />
            <stop offset="65%" stopColor="#cf9c63" />
            <stop offset="100%" stopColor="#704b30" />
          </linearGradient>

          {/* Core bulb glow */}
          <radialGradient id={bulbGrad} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbf0" stopOpacity="0.98" />
            <stop offset="45%" stopColor="#fbd394" stopOpacity="0.75" />
            <stop offset="85%" stopColor="#bc744e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#bc744e" stopOpacity="0" />
          </radialGradient>

          {/* Downward light beam cone */}
          <linearGradient id={beamGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcedd2" stopOpacity={activeLit ? '0.34' : '0.04'} />
            <stop offset="40%" stopColor="#f5d49f" stopOpacity={activeLit ? '0.22' : '0.02'} />
            <stop offset="85%" stopColor="#e0a969" stopOpacity={activeLit ? '0.08' : '0.01'} />
            <stop offset="100%" stopColor="#bc744e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Desk horizon baseline */}
        <path d="M 24 360 Q 180 364 336 360" fill="none" stroke="#a8a095" strokeOpacity="0.22" strokeWidth="1" />

        {/* Downward light beam cone (symmetrical, centered at x=180) */}
        <path
          className="lamp-beam transition-opacity duration-700"
          d="M 95 175 L 265 175 L 335 360 C 235 372 125 372 25 360 Z"
          fill={`url(#${beamGrad})`}
          style={{ opacity: activeLit ? 1 : 0.08 }}
        />

        {/* Grounded desk shadow beneath lamp pedestal */}
        <ellipse cx="180" cy="358" rx="68" ry="7.5" fill="#0b0d0a" fillOpacity="0.65" />

        {/* Stepped Pedestal Base (Centered at x=180, cy=352) */}
        <ellipse cx="180" cy="353" rx="56" ry="11" fill={`url(#${metalGrad})`} stroke="#805a3e" strokeWidth="0.9" strokeOpacity="0.45" />
        <ellipse cx="180" cy="349" rx="46" ry="7.5" fill="#242621" stroke={`url(#${brassGrad})`} strokeWidth="0.8" />
        <ellipse cx="180" cy="344" rx="34" ry="5.5" fill={`url(#${metalGrad})`} stroke={`url(#${brassGrad})`} strokeWidth="0.7" />
        <ellipse cx="180" cy="340" rx="18" ry="3.8" fill={`url(#${brassGrad})`} />

        {/* Classic Turned Fluted Wooden Column Stem (Centered at x=180) */}
        {/* Baluster contour path */}
        <path
          d="M 166 339 C 160 320 156 304 158 290 C 160 274 168 258 171 242 C 173 230 173 218 171 206 C 168 198 168 188 171 180 L 189 180 C 192 188 192 198 189 206 C 187 218 187 230 189 242 C 192 258 200 274 202 290 C 204 304 200 320 194 339 Z"
          fill={`url(#${metalGrad})`}
          stroke="#775136"
          strokeWidth="0.75"
        />

        {/* Fluting highlights running vertically along the column */}
        <path d="M 174 335 C 169 318 167 302 168 290 C 170 276 175 260 176 242 C 177 230 177 218 176 206" fill="none" stroke="#e0ba85" strokeWidth="0.9" strokeOpacity="0.65" />
        <path d="M 180 336 L 180 182" fill="none" stroke="#e0ba85" strokeWidth="1.2" strokeOpacity="0.75" />
        <path d="M 186 335 C 191 318 193 302 192 290 C 190 276 185 260 184 242 C 183 230 183 218 184 206" fill="none" stroke="#775136" strokeWidth="0.8" strokeOpacity="0.5" />

        {/* Decorative turned rings */}
        <ellipse cx="180" cy="290" rx="22" ry="4" fill={`url(#${brassGrad})`} stroke="#e0ba85" strokeWidth="0.6" strokeOpacity="0.8" />
        <ellipse cx="180" cy="242" rx="14" ry="2.8" fill={`url(#${brassGrad})`} stroke="#e0ba85" strokeWidth="0.6" strokeOpacity="0.8" />
        <ellipse cx="180" cy="180" rx="12" ry="2.6" fill={`url(#${brassGrad})`} />

        {/* Polished brass neck riser & socket fitting */}
        <rect x="176" y="166" width="8" height="14" rx="1" fill={`url(#${brassGrad})`} stroke="#e0ba85" strokeWidth="0.6" />
        <ellipse cx="180" cy="166" rx="6.5" ry="2" fill={`url(#${brassGrad})`} />

        {/* Classic Tapered Drum / Empire Shade Body (Forest Green) */}
        {/* Back wall of shade */}
        <path
          d="M 128 72 L 95 175 C 95 189 265 189 265 175 L 232 72 C 232 64 128 64 128 72 Z"
          fill={`url(#${shadeGrad})`}
          stroke="#163528"
          strokeWidth="1.2"
          className="lamp-shade"
        />

        {/* Warm internal shade translucency when lit */}
        <path
          d="M 131 75 L 100 173 C 100 184 260 184 260 173 L 229 75 Z"
          fill={`url(#${shadeInnerGrad})`}
          opacity={activeLit ? 0.4 : 0.04}
          className="transition-opacity duration-700"
        />

        {/* Polished Brass Top Rim Accent */}
        <ellipse cx="180" cy="72" rx="52" ry="7.5" fill="none" stroke={`url(#${brassGrad})`} strokeWidth="1.6" />
        <ellipse cx="180" cy="72" rx="50" ry="6.8" fill="#143023" fillOpacity="0.5" />

        {/* Polished Brass Bottom Rim Accent */}
        <path
          d="M 95 175 C 95 189 265 189 265 175 L 265 178 C 265 192 95 192 95 178 Z"
          fill={`url(#${brassGrad})`}
          stroke="#e1bd8a"
          strokeWidth="0.75"
        />

        {/* Warm Bulb Glow & Lower Aperture */}
        <ellipse
          className="lamp-bulb-glow transition-all duration-700"
          cx="180"
          cy="176"
          rx="72"
          ry="11"
          fill={`url(#${bulbGrad})`}
          style={{
            opacity: activeLit ? 1 : 0.12,
            filter: activeLit ? 'drop-shadow(0 0 16px rgba(255, 214, 153, 0.5))' : 'none',
          }}
        />

        {/* Vertically Hanging Braided Pull Cord with Weighted Brass Teardrop Finial */}
        {/* Connected under shade at x=142, hangs strictly vertical under gravity */}
        <line
          className="lamp-pull-cord"
          x1="142"
          y1="175"
          x2="142"
          y2="230"
          stroke="#d5be9a"
          strokeWidth="1.8"
          strokeDasharray="3 1.5"
        />
        <circle cx="142" cy="231" r="2.5" fill={`url(#${brassGrad})`} />
        {/* Weighted Brass Finial */}
        <path
          className="lamp-cord-fob"
          d="M 138 233 C 138 233 136 244 142 248 C 148 244 146 233 146 233 Z"
          fill={`url(#${brassGrad})`}
          stroke="#edd09e"
          strokeWidth="0.8"
        />
        <ellipse cx="142" cy="247" rx="3.6" ry="2.2" fill={`url(#${brassGrad})`} stroke="#edd09e" strokeWidth="0.6" />
      </svg>

      {(interactive || onPull) && (
        <button
          type="button"
          onClick={handlePull}
          aria-label={activeLit ? 'Turn off lamp illumination' : 'Pull the cord to illuminate your workspace'}
          className="lamp-pull group absolute inset-0 z-10 min-w-[120px] cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
        >
          <span className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 whitespace-nowrap border border-stone-500/70 bg-obsidian/90 px-2.5 py-1 text-[9px] font-mono text-ivory opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 shadow-md">
            {activeLit ? 'Click cord to dim' : 'Click cord to illuminate'}
          </span>
        </button>
      )}
    </div>
  );
};
