import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, CopyPlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { deleteMeal, duplicateMeal, restoreMeal } from '@/db/meals';
import { todayKey } from '@/lib/dates';
import { formatKcal } from '@/lib/format';
import { mealTotals } from '@/lib/nutrition';
import type { Meal } from '@/types';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { MealPhoto } from '@/components/ui/MealPhoto';
import { useToast } from '@/components/ui/Toast';
import { MacroPills } from './MacroPills';

/** Tarjeta de comida con acciones: editar, duplicar y eliminar. */
export function MealCard({ meal }: { meal: Meal }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const totals = mealTotals(meal).values;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  const onDelete = async () => {
    setMenu(false);
    const ok = await confirm({ title: '¿Eliminar esta comida?', message: `Se eliminará «${meal.name}» del diario.`, confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    const backup = { ...meal };
    await deleteMeal(meal.id);
    toast.success('Comida eliminada', { action: { label: 'Deshacer', onClick: () => restoreMeal(backup) } });
  };

  const onDuplicate = async (toToday: boolean) => {
    setMenu(false);
    try {
      await duplicateMeal(meal.id, toToday ? todayKey() : undefined);
      toast.success(toToday ? 'Comida duplicada en hoy' : 'Comida duplicada');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="relative flex items-center gap-3 rounded-2xl p-2 transition hover:bg-ink-50">
      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => navigate(`/comida/${meal.id}`)} aria-label={`Editar ${meal.name}`}>
        <MealPhoto blob={meal.thumb ?? meal.photo} alt={meal.name} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink-900">{meal.name}</div>
          <div className="mt-0.5 text-xs text-ink-400">
            {meal.time} · {meal.items.length} {meal.items.length === 1 ? 'alimento' : 'alimentos'}
          </div>
          <MacroPills n={totals} className="mt-1" />
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold tabular-nums">{formatKcal(totals.kcal ?? 0)}</div>
          <div className="text-[11px] text-ink-400">kcal</div>
        </div>
      </button>
      <div ref={menuRef} className="relative">
        <button aria-label="Más acciones" aria-haspopup="menu" aria-expanded={menu} className="rounded-full p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700" onClick={() => setMenu((m) => !m)}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 top-10 z-30 w-56 animate-scale-in overflow-hidden rounded-2xl bg-white py-1 shadow-lift ring-1 ring-ink-100">
            <MenuItem icon={Pencil} label="Editar" onClick={() => navigate(`/comida/${meal.id}`)} />
            <MenuItem icon={Copy} label="Duplicar" onClick={() => onDuplicate(false)} />
            {meal.date !== todayKey() && <MenuItem icon={CopyPlus} label="Duplicar en hoy" onClick={() => onDuplicate(true)} />}
            <MenuItem icon={Trash2} label="Eliminar" danger onClick={onDelete} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-ink-50 ${danger ? 'text-red-600' : 'text-ink-700'}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
