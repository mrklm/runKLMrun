import { useId } from 'react';
import type { ShoeColors } from '../types/shoe';
import { SHOE_COLOR_ZONES } from '../core/shoes/shoe-colors';

const WIDTH = 200, HEIGHT = 133;
const image = (path: string) => `${import.meta.env.BASE_URL}images/${path}`;

/** Icône décorative d'une paire : l'image d'origine, ou ses zones recolorées puis recouvertes de l'encre fixe. */
export function ShoeIcon({ colors, className = 'shoe-icon' }: { colors?: ShoeColors; className?: string }) {
  const prefix = `shoe-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (!colors) return <img className={className} src={image('basket.png')} alt="" />;
  return <svg className={className} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false" data-shoe-colors={SHOE_COLOR_ZONES.map(zone => colors[zone]).join(' ')}>
    <defs>{SHOE_COLOR_ZONES.map(zone => <mask key={zone} id={`${prefix}-${zone}`} maskUnits="userSpaceOnUse" x="0" y="0" width={WIDTH} height={HEIGHT}>
      <image href={image(`basket-zones/${zone}.png`)} width={WIDTH} height={HEIGHT} />
    </mask>)}</defs>
    {SHOE_COLOR_ZONES.map(zone => <rect key={zone} width={WIDTH} height={HEIGHT} fill={colors[zone]} mask={`url(#${prefix}-${zone})`} />)}
    <image href={image('basket-zones/ink.png')} width={WIDTH} height={HEIGHT} />
  </svg>;
}
