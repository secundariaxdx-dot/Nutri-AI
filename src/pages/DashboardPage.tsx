import { Link } from 'react-router-dom';
import { BarChart3, Camera, ChevronRight, PenLine, ScanBarcode } from 'lucide-react';
import { useMealsByDate, useProfile } from '@/hooks/useData';
import { greeting, formatDateLong, todayKey } from '@/lib/dates';
import { mealsTotals } from '@/lib/nutrition';
import { CalorieSummary } from '@/components/charts/CalorieRing';
import { MacroCard } from '@/components/charts/MacroCard';
import { MealsByType } from '@/components/meal/MealsByType';
import { PageLoader } from '@/components/ui/Spinner';
import { InstallHint } from '@/components/layout/InstallHint';
import { LogoMark } from '@/components/layout/Logo';
import { MicroHighlights } from '@/components/charts/MicroHighlights';

const ACTIONS = [
  { to: '/foto', label: 'Fotografiar comida', icon: Camera, primary: true },
  { to: '/registrar', label: 'Añadir manualmente', icon: PenLine },
  { to: '/escaner', label: 'Escanear código', icon: ScanBarcode },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
];

export default function DashboardPage() {
  const date = todayKey();
  const meals = useMealsByDate(date);
  const profile = useProfile();
  const goals = profile.goals;

  if (!meals) return <PageLoader />;
  const totals = mealsTotals(meals);
  const t = totals.values;

  return (
    <div className="animate-fade-in space-y-5">
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm font-medium text-ink-500">{formatDateLong(date)}</p>
          <h1 className="text-[26px] font-bold tracking-tight lg:text-3xl">
            {greeting()}
            {profile.name ? `, ${profile.name}` : ''}
          </h1>
        </div>
        <LogoMark className="h-10 w-10 lg:hidden" />
      </header>

      <InstallHint />

      <section className="card p-5 sm:p-6" aria-label="Calorías de hoy">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Calorías de hoy</h2>
          {profile.updatedAt === 0 && (
            <Link to="/perfil" className="text-sm font-medium text-brand-700">
              Personalizar objetivo
            </Link>
          )}
        </div>
        <CalorieSummary consumed={t.kcal ?? 0} goal={goals.kcal} />
      </section>

      <section className="grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Macronutrientes">
        <MacroCard label="Proteínas" value={t.protein ?? 0} goal={goals.protein} color="#e2725b" />
        <MacroCard label="Carbohidratos" value={t.carbs ?? 0} goal={goals.carbs} color="#e8a838" />
        <MacroCard label="Grasas" value={t.fat ?? 0} goal={goals.fat} color="#5b8def" />
      </section>

      <section aria-label="Acciones rápidas" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ to, label, icon: Icon, primary }) => (
          <Link
            key={to}
            to={to}
            className={`group flex flex-col justify-between gap-6 rounded-3xl p-4 transition active:scale-[.98] ${
              primary ? 'bg-gradient-to-br from-brand-800 to-brand-950 text-white shadow-lift' : 'card text-ink-800 hover:ring-brand-200'
            }`}
          >
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${primary ? 'bg-white/15' : 'bg-brand-50 text-brand-800'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex items-center justify-between text-sm font-semibold leading-tight">
              {label} <ChevronRight className={`h-4 w-4 transition group-hover:translate-x-0.5 ${primary ? 'text-white/70' : 'text-ink-300'}`} />
            </span>
          </Link>
        ))}
      </section>

      <MicroHighlights totals={totals} fiberGoal={goals.fiber} hasMeals={meals.length > 0} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comidas de hoy</h2>
          <Link to={`/diario?fecha=${date}`} className="text-sm font-medium text-brand-700">
            Ver diario
          </Link>
        </div>
        <MealsByType meals={meals} date={date} />
      </section>
    </div>
  );
}
