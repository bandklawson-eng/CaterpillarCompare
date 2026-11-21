import { selection, family } from '../state';

/** Categorical series colors (validated palette, fixed order). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500'];
/** Cost-component colors for stacked bars (categorical slots 1–8). */
export const PARTS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#8a8984'];

/** A machine keeps its color for as long as it stays selected. */
export function colorOf(id: string): string {
  const i = selection.value[family.value].indexOf(id);
  return SERIES[Math.max(0, i) % SERIES.length];
}

export const n0 = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
export const n1 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : '—');
export const n2 = (v: number) => (Number.isFinite(v) ? v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '—');
export const money = (v: number) => (Number.isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : '—');
export const money2 = (v: number) => (Number.isFinite(v) ? '$' + v.toFixed(2) : '—');
export const pct = (v: number) => {
  const r = Math.round(v * 100);
  return r === 0 ? 'same' : `${r > 0 ? '+' : '−'}${Math.abs(r)}%`;
};
export const times = (v: number) => `${v.toFixed(v >= 10 ? 0 : 1)}×`;

/** Compact job-size label: 38,000 → "38k", 1,250,000 → "1.25M". */
export function vol(v: number): string {
  if (v >= 1e6) return `${+(v / 1e6).toFixed(v >= 1e7 ? 0 : 2)}M`;
  if (v >= 1e3) return `${Math.round(v / 1e3).toLocaleString('en-US')}k`;
  return Math.round(v).toLocaleString('en-US');
}

export const lbToT = (lb: number) => lb / 2204.6;
export const ydToM3 = (y: number) => y * 0.7646;
