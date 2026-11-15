import type { NutrientSource } from '@/types';

export function sourceLabel(s: NutrientSource): string {
  switch (s.kind) {
    case 'usda-sr':
      return 'USDA SR Legacy';
    case 'usda-api':
      return `USDA ${s.dataType ?? 'FDC'}`;
    case 'off':
      return 'Open Food Facts';
    case 'custom':
      return 'Personalizado';
  }
}

export function sourceDetail(s: NutrientSource): string {
  switch (s.kind) {
    case 'usda-sr':
    case 'usda-api':
      return `USDA FoodData Central · FDC ${s.fdcId} · «${s.description}»`;
    case 'off':
      return `Open Food Facts · código ${s.barcode}`;
    case 'custom':
      return s.note ?? 'Valores introducidos por el usuario';
  }
}

export function sourceUrl(s: NutrientSource): string | undefined {
  if (s.kind === 'usda-sr' || s.kind === 'usda-api') return `https://fdc.nal.usda.gov/food-details/${s.fdcId}/nutrients`;
  if (s.kind === 'off') return s.url;
  return undefined;
}

export function SourceBadge({ source }: { source: NutrientSource }) {
  const color =
    source.kind === 'off' ? 'bg-orange-50 text-orange-700' : source.kind === 'custom' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700';
  return (
    <span className={`chip ${color}`} title={sourceDetail(source)}>
      {sourceLabel(source)}
    </span>
  );
}
