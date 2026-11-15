import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraftParams } from '@/hooks/useDraftParams';
import { newDraft, setPendingDraft, takePendingDraft, type MealDraft } from '@/store/draft';
import { PageHeader } from '@/components/layout/PageHeader';
import { MealComposer } from '@/components/meal/MealComposer';
import { useToast } from '@/components/ui/Toast';

/** Registro manual (también recibe borradores del escáner y de alimentos personalizados). */
export default function ManualAddPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { date, mealType } = useDraftParams();
  const [state] = useState<{ draft: MealDraft; restored: boolean }>(() => {
    const pending = takePendingDraft();
    if (pending && !pending.id) return { draft: pending, restored: true };
    if (pending) setPendingDraft(pending); // pertenece a otra pantalla (edición)
    return { draft: newDraft({ ...(date ? { date } : {}), ...(mealType ? { mealType } : {}), origin: 'manual' }), restored: false };
  });

  useEffect(() => {
    if (state.restored && state.draft.origin !== 'codigo') toast.info('Se ha recuperado la comida que estabas registrando.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Añadir comida" subtitle="Busca alimentos y ajusta las cantidades" back />
      <MealComposer
        initial={state.draft}
        openPickerOnMount={state.draft.items.length === 0}
        onSaved={(m) => {
          toast.success('Comida guardada en tu diario');
          navigate(`/diario?fecha=${m.date}`, { replace: true });
        }}
      />
    </div>
  );
}
