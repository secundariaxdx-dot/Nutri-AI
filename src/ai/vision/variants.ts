/**
 * Grupos de variantes de un mismo alimento (distinta preparación o tipo).
 * El primero de cada grupo es la opción NEUTRA (sin grasa añadida) que se usa
 * cuando la IA no puede distinguir la preparación; se marca como «sin
 * confirmar» para que el usuario la cambie en un toque.
 */
import { getFood } from '@/lib/foodDatabase';
import type { Food } from '@/types';

export const VARIANT_GROUPS: string[][] = [
  ['huevo-cocido', 'huevo-frito', 'huevos-revueltos', 'tortilla-francesa', 'huevo-escalfado', 'huevo-crudo'],
  ['pan-payes', 'pan-payes-tostado'],
  ['pan-blanco', 'pan-molde-tostado'],
  ['pan-integral', 'pan-integral-tostado'],
  ['pollo-pechuga-plancha', 'pollo-pechuga-cruda', 'pollo-pechuga-frita', 'pollo-frito-rebozado'],
  ['arroz-blanco-cocido', 'arroz-blanco-crudo'],
  ['arroz-integral-cocido', 'arroz-integral-crudo'],
  ['pasta-cocida', 'pasta-seca'],
  ['patata-cocida', 'patata-asada', 'patatas-fritas', 'pure-patata', 'patata-cruda'],
  ['boniato-asado', 'boniato-crudo'],
  ['filete-ternera-plancha', 'filete-ternera-crudo', 'solomillo-ternera'],
  ['ternera-picada-cocinada', 'ternera-picada-cruda'],
  ['cerdo-lomo-plancha', 'cerdo-lomo-crudo', 'cerdo-solomillo-asado'],
  ['salmon-plancha', 'salmon-crudo', 'salmon-ahumado'],
  ['bacalao-cocinado', 'bacalao-crudo', 'bacalao-salado'],
  ['atun-lata-agua', 'atun-lata-aceite', 'atun-fresco-crudo'],
  ['gambas-cocidas', 'gambas-crudas'],
  ['calamares-fritos', 'calamar-crudo'],
  ['brocoli-cocido', 'brocoli-crudo'],
  ['zanahoria-cruda', 'zanahoria-cocida'],
  ['espinacas-cocidas', 'espinacas-crudas'],
  ['cebolla', 'cebolla-cocida'],
  ['berenjena-cocida', 'berenjena'],
  ['champinones-salteados', 'champinones'],
  ['esparragos-cocidos', 'esparragos-crudos'],
  ['judias-verdes-cocidas', 'judias-verdes-crudas'],
  ['pimiento-rojo', 'pimiento-salteado', 'pimiento-verde'],
  ['garbanzos-cocidos', 'garbanzos-bote'],
  ['leche-semidesnatada', 'leche-entera', 'leche-desnatada'],
  ['yogur-natural', 'yogur-desnatado', 'yogur-griego-0', 'yogur-frutas'],
  ['lechuga-romana', 'lechuga-iceberg'],
  ['mantequilla', 'mantequilla-sin-sal'],
];

const groupOf = new Map<string, string[]>();
for (const g of VARIANT_GROUPS) for (const id of g) groupOf.set(id, g);

export function variantsOf(foodId: string | undefined): Food[] {
  if (!foodId) return [];
  return (groupOf.get(foodId) ?? []).map((id) => getFood(id)).filter((f): f is Food => !!f);
}

export function neutralVariant(foodId: string): Food | undefined {
  const g = groupOf.get(foodId);
  return g ? getFood(g[0]) : undefined;
}
