import { NUTRIENT_MAP } from '@/config/nutrients';
import type { NutrientKey } from '@/types';

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export function formatNumber(v: number, decimals?: number): string {
  if (decimals === 0) return nf0.format(v);
  if (decimals === 1) return nf1.format(v);
  if (decimals === 2) return nf2.format(v);
  const a = Math.abs(v);
  if (a >= 100) return nf0.format(v);
  if (a >= 10) return nf1.format(v);
  return nf2.format(v);
}

export function formatKcal(v: number | undefined): string {
  return v === undefined ? '—' : nf0.format(Math.round(v));
}

/** Formatea un nutriente con su unidad o devuelve "Sin datos". */
export function formatNutrient(key: NutrientKey, v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return 'Sin datos';
  const unit = NUTRIENT_MAP[key].unit;
  if (key === 'kcal') return `${nf0.format(Math.round(v))} kcal`;
  return `${formatNumber(v)} ${unit}`;
}

export function formatGrams(g: number): string {
  return `${nf0.format(Math.round(g))} g`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
