import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface FieldPoint {
  x: number;
  y: number;
}

export const EditorialFieldCanvas: React.FC<{ paused?: boolean }> = ({ paused = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const motionPaused = paused || prefersReducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let points: FieldPoint[] = [];
    let pointer: FieldPoint | null = null;
    const spacing = 76;

    const resize = () => {
      window.cancelAnimationFrame(frame);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      points = [];
      for (let y = spacing / 2; y < height; y += spacing) {
        for (let x = spacing / 2; x < width; x += spacing) points.push({ x, y });
      }
      draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const nearby = points.map((point) => {
        if (!pointer || motionPaused) return { x: point.x, y: point.y, strength: 0 };
        const dx = pointer.x - point.x;
        const dy = pointer.y - point.y;
        const distance = Math.hypot(dx, dy);
        const strength = Math.max(0, 1 - distance / 190);
        const scale = strength * 8;
        return {
          x: point.x - (dx / (distance || 1)) * scale,
          y: point.y - (dy / (distance || 1)) * scale,
          strength,
        };
      });
      const columnCount = Math.max(1, Math.ceil((width - spacing / 2) / spacing));

      nearby.forEach((point, index) => {
        const column = Math.round((points[index].x - spacing / 2) / spacing);
        const nextColumn = index + 1;
        const nextRow = index + columnCount;
        context.lineWidth = 0.65;
        if (nextColumn < nearby.length && (column + 1) < columnCount) {
          context.strokeStyle = `rgba(188,116,78,${0.035 + point.strength * 0.11})`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(nearby[nextColumn].x, nearby[nextColumn].y);
          context.stroke();
        }
        if (nextRow < nearby.length) {
          context.strokeStyle = `rgba(36,76,58,${0.025 + point.strength * 0.09})`;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(nearby[nextRow].x, nearby[nextRow].y);
          context.stroke();
        }
        const glow = pointer && !prefersReducedMotion
          ? Math.max(0, 1 - Math.hypot(pointer.x - point.x, pointer.y - point.y) / 180)
          : 0;
        context.fillStyle = `rgba(${column % 3 === 0 ? '36,76,58' : '188,116,78'},${0.11 + glow * 0.4})`;
        context.beginPath();
        context.arc(point.x, point.y, 0.8 + glow * 1.1, 0, Math.PI * 2);
        context.fill();
      });

    };
    const animate = () => {
      draw();
      frame = window.requestAnimationFrame(animate);
    };

    const movePointer = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (motionPaused) draw();
    };
    const clearPointer = () => {
      pointer = null;
      if (motionPaused) draw();
    };

    resize();
    if (!motionPaused) frame = window.requestAnimationFrame(animate);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', movePointer, { passive: true });
    window.addEventListener('pointerleave', clearPointer);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', movePointer);
      window.removeEventListener('pointerleave', clearPointer);
    };
  }, [motionPaused]);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-70" />;
};
