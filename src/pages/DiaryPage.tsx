import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMealsByDate, useProfile } from '@/hooks/useData';
import { addDays, isValidDateKey, relativeDayLabel, todayKey } from '@/lib/dates';
import { formatKcal } from '@/lib/format';
import { mealsTotals } from '@/lib/nutrition';
import { MacroCard } from '@/components/charts/MacroCard';
import { MealsByType } from '@/components/meal/MealsByType';
import { NutrientTable } from '@/components/meal/NutrientTable';
import { Calendar } from '@/components/ui/Calendar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageLoader } from '@/components/ui/Spinner';

export default function DiaryPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('fecha');
  const date = raw && isValidDateKey(raw) ? raw : todayKey();
  const meals = useMealsByDate(date);
  const goals = useProfile().goals;
  const [calendar, setCalendar] = useState(false);
  const [tab, setTab] = useState<'comidas' | 'nutrientes'>('comidas');

  const go = (d: string) => setParams(d === todayKey() ? {} : { fecha: d }, { replace: true });

  return (
    <div className="animate-fade-in">
      <header className="mb-5 pt-2">
        <h1 className="text-[26px] font-bold tracking-tight lg:text-3xl">Diario</h1>
        <div className="mt-3 flex items-center gap-2">
          <button aria-label="Día anterior" className="rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-ink-100 hover:bg-ink-50" onClick={() => go(addDays(date, -1))}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 font-semibold shadow-card ring-1 ring-ink-100 hover:bg-ink-50" onClick={() => setCalendar(true)}>
            <CalendarDays className="h-4 w-4 text-brand-700" /> {relativeDayLabel(date)}
          </button>
          <button aria-label="Día siguiente" className="rounded-2xl bg-white p-2.5 shadow-card ring-1 ring-ink-100 hover:bg-ink-50" onClick={() => go(addDays(date, 1))}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      {!meals ? (
        <PageLoader />
      ) : (
        <div key={date} className="animate-fade-in space-y-5">
          <DaySummary meals={meals} goals={goals} />
          {meals.length > 0 && (
            <div className="flex rounded-2xl bg-ink-100 p-1" role="tablist">
              {(['comidas', 'nutrientes'] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${tab === t ? 'bg-white text-brand-900 shadow-sm' : 'text-ink-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          {meals.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={BookOpen}
                title="No hay comidas este día"
                text="Registra lo que has comido para ver tus calorías y nutrientes."
                action={
                  <Link to={`/anadir?fecha=${date}`} className="btn-primary">
                    <Plus className="h-5 w-5" /> Añadir comida
                  </Link>
                }
              />
            </div>
          ) : tab === 'comidas' ? (
            <MealsByType meals={meals} date={date} />
          ) : (
            <div className="card p-5">
              <NutrientTable values={mealsTotals(meals).values} totals={mealsTotals(meals)} />
            </div>
          )}
        </div>
      )}

      <Modal open={calendar} onClose={() => setCalendar(false)} title="Elegir fecha" size="sm">
        <Calendar
          value={date}
          onChange={(d) => {
            go(d);
            setCalendar(false);
          }}
        />
      </Modal>
    </div>
  );
}

function DaySummary({ meals, goals }: { meals: Parameters<typeof mealsTotals>[0]; goals: ReturnType<typeof useProfile>['goals'] }) {
  const t = mealsTotals(meals).values;
  const kcal = t.kcal ?? 0;
  return (
    <div className="space-y-3">
      <section className="card p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="section-title">Calorías</h2>
            <p className="mt-1 text-3xl font-bold tabular-nums text-brand-950">
              {formatKcal(kcal)} <span className="text-base font-medium text-ink-400">/ {formatKcal(goals.kcal)} kcal</span>
            </p>
          </div>
          <span className={`text-sm font-semibold tabular-nums ${kcal > goals.kcal * 1.05 ? 'text-amber-600' : 'text-brand-700'}`}>{Math.round((kcal / goals.kcal) * 100)} %</span>
        </div>
        <ProgressBar value={kcal / goals.kcal} className="mt-3 h-2.5" label="Calorías del día" />
      </section>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <MacroCard label="Proteínas" value={t.protein ?? 0} goal={goals.protein} color="#e2725b" />
        <MacroCard label="Carbohidratos" value={t.carbs ?? 0} goal={goals.carbs} color="#e8a838" />
        <MacroCard label="Grasas" value={t.fat ?? 0} goal={goals.fat} color="#5b8def" />
      </div>
    </div>
  );
}
