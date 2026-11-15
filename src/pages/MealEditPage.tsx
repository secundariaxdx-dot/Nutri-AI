import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, SearchX, Trash2 } from 'lucide-react';
import { deleteMeal, duplicateMeal, restoreMeal } from '@/db/meals';
import { useMeal } from '@/hooks/useData';
import { draftFromMeal, setPendingDraft, takePendingDraft } from '@/store/draft';
import type { Meal } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { MealComposer } from '@/components/meal/MealComposer';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { MealPhoto } from '@/components/ui/MealPhoto';
import { PageLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export default function MealEditPage() {
  const { id } = useParams();
  const meal = useMeal(id);
  const navigate = useNavigate();

  if (meal === undefined) return <PageLoader />;
  if (meal === null)
    return (
      <div>
        <PageHeader title="Comida" back="/diario" />
        <EmptyState icon={SearchX} title="Comida no encontrada" text="Puede que se haya eliminado." action={<button className="btn-primary" onClick={() => navigate('/diario')}>Ir al diario</button>} />
      </div>
    );
  return <Editor key={meal.id} meal={meal} />;
}

function Editor({ meal }: { meal: Meal }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [initial] = useState(() => {
    const pending = takePendingDraft();
    if (pending?.id === meal.id) return pending;
    if (pending) setPendingDraft(pending);
    return draftFromMeal(meal);
  });

  const remove = async () => {
    if (!(await confirm({ title: '¿Eliminar esta comida?', message: 'Esta acción se puede deshacer justo después.', confirmLabel: 'Eliminar', danger: true }))) return;
    const backup = { ...meal };
    await deleteMeal(meal.id);
    toast.success('Comida eliminada', { action: { label: 'Deshacer', onClick: () => restoreMeal(backup) } });
    navigate(`/diario?fecha=${meal.date}`, { replace: true });
  };

  const duplicate = async () => {
    const copy = await duplicateMeal(meal.id);
    toast.success('Comida duplicada');
    navigate(`/comida/${copy.id}`, { replace: true });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Editar comida"
        back
        actions={
          <>
            <button aria-label="Duplicar comida" className="rounded-full p-2.5 text-ink-600 hover:bg-ink-100" onClick={duplicate}>
              <Copy className="h-5 w-5" />
            </button>
            <button aria-label="Eliminar comida" className="rounded-full p-2.5 text-red-600 hover:bg-red-50" onClick={remove}>
              <Trash2 className="h-5 w-5" />
            </button>
          </>
        }
      />
      <MealComposer
        initial={initial}
        header={meal.photo ? <MealPhoto blob={meal.photo} alt={meal.name} className="aspect-[4/3] max-h-80 w-full" /> : undefined}
        saveLabel="Guardar cambios"
        onSaved={(m) => {
          toast.success('Cambios guardados');
          navigate(`/diario?fecha=${m.date}`, { replace: true });
        }}
      />
    </div>
  );
}
