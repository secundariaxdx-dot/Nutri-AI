import { useSearchParams } from 'react-router-dom';
import { MEAL_TYPES } from '@/config/app';
import { isValidDateKey } from '@/lib/dates';
import type { MealType } from '@/types';

/** Lee ?fecha=YYYY-MM-DD&tipo=comida para preseleccionar el destino de la comida. */
export function useDraftParams(): { date?: string; mealType?: MealType; query: string } {
  const [params] = useSearchParams();
  const fecha = params.get('fecha') ?? undefined;
  const tipo = params.get('tipo') as MealType | null;
  const date = fecha && isValidDateKey(fecha) ? fecha : undefined;
  const mealType = tipo && MEAL_TYPES.some((m) => m.value === tipo) ? tipo : undefined;
  const qs = new URLSearchParams();
  if (date) qs.set('fecha', date);
  if (mealType) qs.set('tipo', mealType);
  const query = qs.toString() ? `?${qs}` : '';
  return { date, mealType, query };
}
