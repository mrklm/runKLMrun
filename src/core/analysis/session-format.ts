export const duration = (value: number) => Number.isFinite(value) && value >= 0 ? `${Math.floor(value / 3600)} h ${Math.floor(value / 60) % 60} min ${Math.floor(value % 60)} s` : '—';
export const pace = (value?: number) => { if (value === undefined || !Number.isFinite(value) || value < 0) return '—'; const s = Math.round(value); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`; };
export const measure = (value: number | undefined, unit = '', divisor = 1) => value === undefined || !Number.isFinite(value) ? '—' : `${(value / divisor).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;

/** Arrondi de présentation uniquement ; les valeurs source restent intactes. */
const displayNumber = (value: number | undefined, digits: number, unit: string) => value === undefined || !Number.isFinite(value) ? '—' : `${value.toLocaleString('fr-FR', { maximumFractionDigits: digits })} ${unit}`;
export const heartRate = (value?: number) => displayNumber(value, 0, 'bpm');
export const ascent = (value?: number) => displayNumber(value, 3, 'm');
