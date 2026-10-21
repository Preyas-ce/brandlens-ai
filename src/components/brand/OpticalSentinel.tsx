import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TOKENS = ['R-101', 'EVI-02', 'UNVERIFIED', 'GATE:LOCKED', '100%', '0101'];

export const OpticalSentinel: React.FC<{ paused?: boolean; compact?: boolean }> = ({ paused = false, compact = false }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [scanning, setScanning] = useState(false);
  const target = useRef({ x: 0, y: 0 });
  const frame = useRef(0);
  const reducedMotion = useReducedMotion();
  const isPaused = paused || reducedMotion;

  useEffect(() => {
    if (isPaused) return;
    const onPointerMove = (event: PointerEvent) => {
      target.current = {
        x: Math.max(-1, Math.min(1, (event.clientX / window.innerWidth - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, (event.clientY / window.innerHeight - 0.5) * 2)),
      };
      const targetElement = event.target;
      setScanning(targetElement instanceof Element && Boolean(targetElement.closest('button, a, [role="button"]')));
    };
    const onPointerLeave = () => setScanning(false);
    const animate = () => {
      setTilt((current) => ({
        x: current.x + (target.current.y * -11 - current.x) * 0.075,
        y: current.y + (target.current.x * 15 - current.y) * 0.075,
      }));
      setGaze((current) => ({
        x: current.x + (target.current.x * 5 - current.x) * 0.12,
        y: current.y + (target.current.y * 4 - current.y) * 0.12,
      }));
      frame.current = window.requestAnimationFrame(animate);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    frame.current = window.requestAnimationFrame(animate);
    const blinkTimer = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 130);
    }, 3900);
    return () => {
      window.cancelAnimationFrame(frame.current);
      window.clearInterval(blinkTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [isPaused]);

  return (
    <div className={`optical-sentinel relative mx-auto grid place-items-center ${compact ? 'h-44 w-56' : 'h-64 w-72'}`} aria-label="Cursor-tracking BrandLens optical sentinel">
      <div className="sentinel-orbit absolute inset-[8%] [perspective:500px]" aria-hidden="true" style={{ animationPlayState: isPaused ? 'paused' : 'running' }}>
        <div className="sentinel-orbit-ring absolute inset-0 [transform-style:preserve-3d]" style={{ animationPlayState: isPaused ? 'paused' : 'running' }}>
          {TOKENS.map((token, index) => (
            <span
              key={token}
              className={`sentinel-token absolute left-1/2 top-1/2 border px-1.5 py-1 font-mono text-[7px] uppercase tracking-wider ${index % 2 ? 'border-forest-300/50 bg-forest-900/80 text-forest-100' : 'border-copper-300/60 bg-obsidian-900/90 text-copper-100'}`}
              style={{ transform: `rotateY(${index * 60}deg) translateZ(112px) translateX(-50%) translateY(-50%)`, animationPlayState: isPaused ? 'paused' : 'running' }}
            >
              {token}
            </span>
          ))}
        </div>
      </div>
      <div className="sentinel-gimbal relative z-10 grid place-items-center" style={{ transform: `perspective(680px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: isPaused ? 'none' : 'transform 80ms linear' }}>
        <div className="sentinel-housing relative grid place-items-center">
          <div className="sentinel-face relative grid place-items-center">
            <div className={`sentinel-scanline absolute inset-x-3 h-px bg-copper-200/90 shadow-[0_0_10px_rgba(200,100,50,0.9)] ${scanning && !isPaused ? 'sentinel-scanning' : ''}`} aria-hidden="true" />
            <div className="flex items-center gap-3">
              {[0, 1].map((eye) => (
                <svg key={eye} viewBox="0 0 52 52" className={`h-12 w-12 overflow-visible ${blink ? 'scale-y-[0.08]' : ''}`} aria-hidden="true">
                  <circle cx="26" cy="26" r="23" fill="#101311" stroke="#C86432" strokeOpacity=".72" strokeWidth="1.2" />
                  <circle cx="26" cy="26" r="16" fill="none" stroke="#1E3A2F" strokeWidth="1" />
                  {[...Array(7)].flatMap((_, row) => [...Array(7)].map((__, col) => {
                    const x = 8 + col * 6;
                    const y = 8 + row * 6;
                    const dx = x - 26;
                    const dy = y - 26;
                    const visible = dx * dx + dy * dy < 330;
                    return visible ? <circle key={`${row}-${col}`} cx={x} cy={y} r={row === 3 && col === 3 ? 2 : 1.05} fill={row === 3 && col === 3 ? '#E8B17E' : '#7EB298'} fillOpacity={row === 3 && col === 3 ? 1 : 0.55} /> : null;
                  }))}
                  <circle cx={26 + gaze.x} cy={26 + gaze.y} r={scanning ? 5 : 3.5} fill="#C86432" fillOpacity=".9" className={scanning ? 'sentinel-reticle' : ''} />
                  <path d="M26 2v8M26 42v8M2 26h8M42 26h8" stroke="#EAC3AE" strokeWidth="1" strokeOpacity=".7" />
                </svg>
              ))}
            </div>
            <span className="mt-2 font-mono text-[7px] uppercase tracking-[0.2em] text-copper-200">BrandLens / Optic 06</span>
          </div>
          <span className="sentinel-mount absolute -bottom-3 left-1/2 h-4 w-28 -translate-x-1/2 rounded-b-full border border-copper-400/30 bg-obsidian-900" aria-hidden="true" />
        </div>
      </div>
      {!compact && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-mono uppercase tracking-[0.16em] text-stone-500">
          Cursor tracking · {scanning ? 'Scan active' : 'Gate watch'}
        </span>
      )}
    </div>
  );
};
