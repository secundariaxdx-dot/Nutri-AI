import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';

export default function NotFoundPage() {
  return (
    <>
    <PageHeader title="Página no encontrada" />
    <EmptyState
      icon={Compass}
      title="Esta dirección no existe"
      text="Puede que el enlace sea antiguo."
      action={
        <Link to="/" className="btn-primary">
          Volver al inicio
        </Link>
      }
    />
    </>
  );
}
