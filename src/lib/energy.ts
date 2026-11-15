/**
 * Estimación ORIENTATIVA del gasto energético.
 * - Metabolismo basal: ecuación de Mifflin-St Jeor (1990).
 * - Gasto total: basal × factor de actividad (FAO/OMS).
 * No sustituye el consejo de un profesional sanitario.
 */
import { ACTIVITY_OPTIONS } from '@/config/app';
import type { ActivityLevel, Goals, GoalType, Sex } from '@/types';

export interface EnergyInput {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: GoalType;
}

export function bmrMifflin({ age, sex, heightCm, weightKg }: Pick<EnergyInput, 'age' | 'sex' | 'heightCm' | 'weightKg'>): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  // Sin sexo especificado se usa el punto medio de ambas constantes (+5 y −161).
  const offset = sex === 'hombre' ? 5 : sex === 'mujer' ? -161 : -78;
  return base + offset;
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_OPTIONS.find((a) => a.value === level)?.factor ?? 1.2;
}

export function tdee(input: EnergyInput): number {
  return bmrMifflin(input) * activityFactor(input.activity);
}

const GOAL_ADJUST: Record<GoalType, number> = { mantener: 0, perder: -0.15, ganar: 0.1, musculo: 0.1 };
/** Proteína en g por kg de peso corporal según objetivo (rangos habituales en la literatura). */
const PROTEIN_PER_KG: Record<GoalType, number> = { mantener: 1.2, perder: 1.6, ganar: 1.4, musculo: 1.8 };

/** Calcula objetivos diarios moderados. Nunca baja del metabolismo basal ni de 1200 kcal. */
export function computeGoals(input: EnergyInput): Goals & { bmr: number; tdee: number } {
  const bmr = bmrMifflin(input);
  const total = tdee(input);
  const floor = Math.max(1200, bmr);
  const kcal = Math.round(Math.max(floor, total * (1 + GOAL_ADJUST[input.goal])) / 10) * 10;
  const protein = Math.round(Math.min(input.weightKg * PROTEIN_PER_KG[input.goal], (kcal * 0.35) / 4));
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.max(25, Math.round((kcal / 1000) * 14));
  return { kcal, protein, carbs, fat, fiber, bmr: Math.round(bmr), tdee: Math.round(total) };
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
