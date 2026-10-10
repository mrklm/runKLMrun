import { useRef } from 'react';
import { usePlotArea } from 'recharts';
import { isTap, pointerTime } from '../core/analysis/time-cursor';
export interface CursorInteraction { domain: [number, number]; onHover: (time: number) => void; onSelect: (time: number) => void; onLeave: () => void }
/** Coordonnées du vrai rectangle de tracé fourni par Recharts, sans index de point. */
export function TimeCursorOverlay({ domain, onHover, onSelect, onLeave }: CursorInteraction) {
  const area = usePlotArea();
  const touch = useRef<{ x: number; y: number } | null>(null);
  if (!area) return null;
  return <rect x={area.x} y={area.y} width={area.width} height={area.height} fill="transparent" aria-hidden="true" style={{ touchAction: 'pan-y' }}
    onPointerMove={event => {
      if (event.pointerType !== 'mouse') return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const time = pointerTime(event.clientX, bounds.left, bounds.width, domain);
      if (time !== undefined) onHover(time);
    }}
    onPointerLeave={() => { touch.current = null; onLeave(); }}
    onPointerDown={event => { if (event.pointerType !== 'mouse') touch.current = { x: event.clientX, y: event.clientY }; }}
    onPointerCancel={() => { touch.current = null; }}
    onPointerUp={event => {
      if (event.pointerType === 'mouse' || !isTap(touch.current, { x: event.clientX, y: event.clientY })) { touch.current = null; return; }
      touch.current = null;
      const bounds = event.currentTarget.getBoundingClientRect();
      const time = pointerTime(event.clientX, bounds.left, bounds.width, domain);
      if (time !== undefined) onSelect(time);
    }} />;
}
