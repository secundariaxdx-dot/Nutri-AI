import { useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Flame, Target, TrendingUp } from 'lucide-react';
import { MICRO_KEYS, NUTRIENT_MAP } from '@/config/nutrients';
import { useMealsInRange, useProfile, useWeights } from '@/hooks/useData';
import { addDays, formatDateShort, todayKey } from '@/lib/dates';
import { formatKcal, formatNumber } from '@/lib/format';
import { buildDailySeries, summarize } from '@/lib/stats';
import type { NutrientKey } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Segmented } from '@/components/ui/Segmented';
import { PageLoader } from '@/components/ui/Spinner';

const RANGES = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
  { value: '90', label: '90 días' },
] as const;

const AXIS = { fontSize: 11, fill: '#98a39a' };

export default function StatsPage() {
  const [range, setRange] = useState<'7' | '30' | '90'>('7');
  const days = Number(range);
  const end = todayKey();
  const start = addDays(end, -(days - 1));
  const meals = useMealsInRange(start, end);
  const goals = useProfile().goals;
  const weights = useWeights();
  const [micro, setMicro] = useState<NutrientKey>('fiber');

  const series = useMemo(() => (meals ? buildDailySeries(meals, days, end) : []), [meals, days, end]);
  const summary = useMemo(() => summarize(series, goals), [series, goals]);
  const chartData = series.map((d) => ({
    date: d.date,
    label: formatDateShort(d.date),
    kcal: d.logged ? Math.round(d.values.kcal ?? 0) : null,
    protein: d.logged ? Math.round(d.values.protein ?? 0) : null,
    carbs: d.logged ? Math.round(d.values.carbs ?? 0) : null,
    fat: d.logged ? Math.round(d.values.fat ?? 0) : null,
    micro: d.logged && d.values[micro] !== undefined ? Number(((d.values[micro]! / refFor(micro, goals.fiber)) * 100).toFixed(0)) : null,
  }));
  const weightData = weights.filter((w) => w.date >= start).map((w) => ({ label: formatDateShort(w.date), kg: w.kg }));

  if (!meals) return <PageLoader />;

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Estadísticas" subtitle="Evolución de tu alimentación" />
      <Segmented label="Periodo" value={range} onChange={setRange} options={RANGES.map((r) => ({ ...r }))} className="w-full sm:w-auto" />

      {summary.loggedDays === 0 ? (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="Aún no hay datos en este periodo"
            text="Registra comidas durante varios días para ver tu evolución."
            action={
              <Link to="/anadir" className="btn-primary">
                Registrar comida
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Flame} label="Media diaria" value={formatKcal(summary.avg.kcal)} unit="kcal" />
            <Kpi icon={TrendingUp} label="Proteína media" value={formatNumber(summary.avg.protein ?? 0, 0)} unit="g/día" />
            <Kpi icon={Target} label="Objetivo cumplido" value={`${summary.daysOnTarget}/${summary.loggedDays}`} unit="días" hint="Calorías entre el 90 % y el 110 % del objetivo" />
            <Kpi icon={BarChart3} label="Días registrados" value={`${summary.loggedDays}/${days}`} unit="" />
          </section>

          <ChartCard title="Calorías" subtitle={`Objetivo: ${formatKcal(goals.kcal)} kcal`}>
            <BarChart data={chartData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef0ee" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip unit="kcal" />} cursor={{ fill: '#f6f8f5' }} />
              <ReferenceLine y={goals.kcal} stroke="#1f7c4e" strokeDasharray="4 4" />
              <Bar dataKey="kcal" name="Calorías" fill="#2d9a62" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Macronutrientes" subtitle="Gramos por día" legend>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#eef0ee" />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip content={<Tip unit="g" />} />
              <Line type="monotone" dataKey="protein" name="Proteínas" stroke="#e2725b" strokeWidth={2.5} dot={{ r: days <= 7 ? 3.5 : 2 }} connectNulls />
              <Line type="monotone" dataKey="carbs" name="Carbohidratos" stroke="#e8a838" strokeWidth={2.5} dot={{ r: days <= 7 ? 3.5 : 2 }} connectNulls />
              <Line type="monotone" dataKey="fat" name="Grasas" stroke="#5b8def" strokeWidth={2.5} dot={{ r: days <= 7 ? 3.5 : 2 }} connectNulls />
            </LineChart>
          </ChartCard>

          <section className="card p-5">
            <h2 className="font-semibold">Medias del periodo</h2>
            <p className="text-xs text-ink-500">Calculadas sobre los {summary.loggedDays} días con registros</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(['protein', 'carbs', 'fat'] as const).map((k) => (
                <div key={k} className="rounded-2xl bg-ink-50 p-3">
                  <div className="text-xs text-ink-500">{NUTRIENT_MAP[k].label}</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{formatNumber(summary.avg[k] ?? 0, 0)} g</div>
                  <div className="text-xs text-ink-400">objetivo {goals[k]} g</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">Micronutrientes</h2>
                <p className="text-xs text-ink-500">% del valor de referencia diario</p>
              </div>
              <select className="input w-auto py-2 text-sm" value={micro} onChange={(e) => setMicro(e.target.value as NutrientKey)} aria-label="Nutriente">
                {(['fiber', ...MICRO_KEYS] as NutrientKey[]).map((k) => (
                  <option key={k} value={k}>
                    {NUTRIENT_MAP[k].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#eef0ee" />
                  <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                  <Tooltip content={<Tip unit="%" />} />
                  <ReferenceLine y={100} stroke="#1f7c4e" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="micro" name={NUTRIENT_MAP[micro].label} stroke="#1f7c4e" strokeWidth={2.5} dot={{ r: days <= 7 ? 3.5 : 2 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <h3 className="section-title mb-3 mt-6">Media del periodo</h3>
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {MICRO_KEYS.map((k) => {
                const v = summary.avg[k];
                const def = NUTRIENT_MAP[k];
                const pct = v !== undefined ? (v / (def.reference ?? 1)) * 100 : undefined;
                return (
                  <li key={k} className="text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-600">{def.label}</span>
                      <span className={`tabular-nums ${pct === undefined ? 'italic text-ink-400' : def.isLimit && pct > 100 ? 'font-semibold text-amber-600' : 'font-medium'}`}>
                        {pct === undefined ? 'Sin datos' : `${Math.round(pct)} %`}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct ?? 0)}%`, background: def.isLimit ? '#98a39a' : '#2d9a62' }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {weightData.length > 1 && (
            <ChartCard title="Peso" subtitle="Según las actualizaciones de tu perfil">
              <LineChart data={weightData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0ee" />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <Tooltip content={<Tip unit="kg" />} />
                <Line type="monotone" dataKey="kg" name="Peso" stroke="#13412e" strokeWidth={2.5} />
              </LineChart>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

function refFor(k: NutrientKey, fiberGoal: number) {
  return k === 'fiber' ? fiberGoal : NUTRIENT_MAP[k].reference ?? 1;
}

function Kpi({ icon: Icon, label, value, unit, hint }: { icon: typeof Flame; label: string; value: string; unit: string; hint?: string }) {
  return (
    <div className="card p-4" title={hint}>
      <div className="flex items-center gap-2 text-xs font-medium text-ink-500">
        <Icon className="h-4 w-4 text-brand-600" /> {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">
        {value} <span className="text-xs font-medium text-ink-400">{unit}</span>
      </div>
      {hint && <div className="mt-1 text-[11px] leading-tight text-ink-400">{hint}</div>}
    </div>
  );
}

function ChartCard({ title, subtitle, children, legend }: { title: string; subtitle?: string; children: ReactElement; legend?: boolean }) {
  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex gap-3 text-xs text-ink-600">
            <Legend color="#e2725b" label="Proteínas" />
            <Legend color="#e8a838" label="Carbohidratos" />
            <Legend color="#5b8def" label="Grasas" />
          </div>
        )}
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

interface TipProps {
  active?: boolean;
  label?: string;
  unit: string;
  payload?: { name: string; value: number | null; color?: string; stroke?: string; fill?: string }[];
}
function Tip({ active, payload, label, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-ink-900 px-3 py-2 text-xs text-white shadow-lift">
      <div className="mb-1 font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.stroke ?? p.fill ?? p.color }} />
          {p.name}: <span className="font-semibold tabular-nums">{p.value === null ? 'Sin registro' : `${formatNumber(p.value, 0)} ${unit}`}</span>
        </div>
      ))}
    </div>
  );
}
