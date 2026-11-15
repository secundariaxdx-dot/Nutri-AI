import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Info, Save } from 'lucide-react';
import { ACTIVITY_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS } from '@/config/app';
import { canComputeGoals, saveProfile } from '@/db/profile';
import { useProfileLoaded } from '@/hooks/useData';
import { bmi, computeGoals } from '@/lib/energy';
import { formatNumber } from '@/lib/format';
import type { Goals, Profile } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { NumberInput } from '@/components/ui/NumberInput';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_PROFILE } from '@/db/profile';

export default function ProfilePage() {
  const loaded = useProfileLoaded();
  if (loaded === undefined) return <PageLoader />;
  return <ProfileForm initial={loaded ?? DEFAULT_PROFILE} />;
}

function ProfileForm({ initial }: { initial: Profile }) {
  const toast = useToast();
  const [p, setP] = useState<Profile>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(initial), [initial]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const setGoal = (k: keyof Goals, v: number | undefined) => setP((prev) => ({ ...prev, goals: { ...prev.goals, [k]: v ?? 0 } }));

  const computed = useMemo(
    () =>
      canComputeGoals(p)
        ? computeGoals({ age: p.age!, sex: p.sex, heightCm: p.heightCm!, weightKg: p.weightKg!, activity: p.activity, goal: p.goal })
        : null,
    [p],
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (p.age !== undefined && (p.age < 14 || p.age > 110)) e.age = 'Introduce una edad entre 14 y 110 años';
    if (p.heightCm !== undefined && (p.heightCm < 100 || p.heightCm > 250)) e.heightCm = 'Altura entre 100 y 250 cm';
    if (p.weightKg !== undefined && (p.weightKg < 30 || p.weightKg > 350)) e.weightKg = 'Peso entre 30 y 350 kg';
    if (p.targetWeightKg !== undefined && (p.targetWeightKg < 30 || p.targetWeightKg > 350)) e.targetWeightKg = 'Peso objetivo entre 30 y 350 kg';
    if (!p.autoGoals) {
      if (!(p.goals.kcal >= 800 && p.goals.kcal <= 6000)) e.kcal = 'Calorías entre 800 y 6000';
      for (const k of ['protein', 'carbs', 'fat', 'fiber'] as const) if (!(p.goals[k] >= 0 && p.goals[k] <= 1000)) e[k] = 'Valor no válido';
    }
    if (p.autoGoals && !computed) e.auto = 'Para el cálculo automático indica edad, altura y peso, o define objetivos personalizados.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!validate()) return toast.error('Revisa los campos marcados');
    setSaving(true);
    try {
      await saveProfile(p);
      toast.success('Perfil y objetivos actualizados');
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => errors[k] && <p className="mt-1 text-xs text-red-600">{errors[k]}</p>;
  const showBmi = p.weightKg && p.heightCm ? bmi(p.weightKg, p.heightCm) : null;

  return (
    <form onSubmit={onSubmit} className="animate-fade-in space-y-5" noValidate>
      <PageHeader title="Perfil y objetivos" subtitle="Personaliza tus objetivos diarios" />

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Datos personales</h2>
        <div>
          <label className="label" htmlFor="pname">
            Nombre (opcional)
          </label>
          <input id="pname" className="input" maxLength={40} value={p.name ?? ''} onChange={(e) => set('name', e.target.value || undefined)} placeholder="Cómo quieres que te saludemos" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="age">
              Edad
            </label>
            <NumberInput id="age" value={p.age} onChange={(v) => set('age', v === undefined ? undefined : Math.round(v))} min={1} max={120} suffix="años" />
            {err('age')}
          </div>
          <div>
            <label className="label" htmlFor="sex">
              Sexo fisiológico
            </label>
            <select id="sex" className="input" value={p.sex} onChange={(e) => set('sex', e.target.value as Profile['sex'])}>
              {SEX_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="height">
              Altura
            </label>
            <NumberInput id="height" value={p.heightCm} onChange={(v) => set('heightCm', v)} min={1} max={300} suffix="cm" />
            {err('heightCm')}
          </div>
          <div>
            <label className="label" htmlFor="weight">
              Peso actual
            </label>
            <NumberInput id="weight" value={p.weightKg} onChange={(v) => set('weightKg', v)} min={1} max={400} suffix="kg" />
            {err('weightKg')}
          </div>
          <div>
            <label className="label" htmlFor="tweight">
              Peso objetivo
            </label>
            <NumberInput id="tweight" value={p.targetWeightKg} onChange={(v) => set('targetWeightKg', v)} min={1} max={400} suffix="kg" />
            {err('targetWeightKg')}
          </div>
          {showBmi && (
            <div className="flex flex-col justify-end">
              <div className="rounded-2xl bg-ink-50 px-4 py-3 text-sm">
                IMC <span className="font-semibold">{formatNumber(showBmi, 1)}</span>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-ink-500">El sexo fisiológico solo se usa para la fórmula del gasto energético. Si prefieres no indicarlo, se usa un valor intermedio.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Nivel de actividad física</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {ACTIVITY_OPTIONS.map((o) => (
            <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition ${p.activity === o.value ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'}`}>
              <input type="radio" name="activity" className="mt-1 accent-brand-700" checked={p.activity === o.value} onChange={() => set('activity', o.value)} />
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-ink-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Objetivo personal</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {GOAL_OPTIONS.map((o) => (
            <label key={o.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition ${p.goal === o.value ? 'bg-brand-50 ring-brand-300' : 'ring-ink-200 hover:bg-ink-50'}`}>
              <input type="radio" name="goal" className="mt-1 accent-brand-700" checked={p.goal === o.value} onChange={() => set('goal', o.value)} />
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-ink-500">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Objetivos diarios</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <span className="text-ink-600">Calcular automáticamente</span>
            <input type="checkbox" role="switch" className="h-5 w-9 cursor-pointer accent-brand-700" checked={p.autoGoals} onChange={(e) => set('autoGoals', e.target.checked)} />
          </label>
        </div>

        {p.autoGoals ? (
          computed ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <GoalTile label="Calorías" value={`${computed.kcal}`} unit="kcal" />
                <GoalTile label="Proteínas" value={`${computed.protein}`} unit="g" />
                <GoalTile label="Carbohidratos" value={`${computed.carbs}`} unit="g" />
                <GoalTile label="Grasas" value={`${computed.fat}`} unit="g" />
                <GoalTile label="Fibra" value={`${computed.fiber}`} unit="g" />
              </div>
              <div className="flex gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Metabolismo basal estimado: <strong>{computed.bmr} kcal</strong> (ecuación de Mifflin-St Jeor). Gasto diario estimado: <strong>{computed.tdee} kcal</strong>.
                  Es una <strong>estimación orientativa</strong>, no una recomendación médica. Los ajustes son moderados (−15 % / +10 %) y nunca bajan del metabolismo
                  basal. Consulta con un profesional sanitario si tienes una condición de salud, estás embarazada o eres menor de edad.
                </p>
              </div>
            </>
          ) : (
            <p className="rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">Completa edad, altura y peso para calcular tus objetivos, o desactiva el cálculo automático.</p>
          )
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {(
              [
                ['kcal', 'Calorías', 'kcal'],
                ['protein', 'Proteínas', 'g'],
                ['carbs', 'Carbohidratos', 'g'],
                ['fat', 'Grasas', 'g'],
                ['fiber', 'Fibra', 'g'],
              ] as const
            ).map(([k, label, unit]) => (
              <div key={k}>
                <label className="label" htmlFor={`g-${k}`}>
                  {label}
                </label>
                <NumberInput id={`g-${k}`} value={p.goals[k]} onChange={(v) => setGoal(k, v)} min={0} max={10000} suffix={unit} allowEmpty={false} />
                {err(k)}
              </div>
            ))}
          </div>
        )}
        {err('auto')}
      </section>

      <div className="sticky bottom-24 z-10 lg:bottom-4">
        <button className="btn-primary w-full py-4 shadow-lift" disabled={saving}>
          <Save className="h-5 w-5" /> {saving ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </div>
    </form>
  );
}

function GoalTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-brand-50 p-3">
      <div className="text-xs text-brand-900/70">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums text-brand-950">
        {value} <span className="text-xs font-medium">{unit}</span>
      </div>
    </div>
  );
}
