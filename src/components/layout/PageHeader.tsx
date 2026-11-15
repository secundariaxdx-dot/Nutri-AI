import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  subtitle?: ReactNode;
  back?: boolean | string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, back, actions }: Props) {
  const navigate = useNavigate();
  return (
    <header className="mb-5 flex items-start gap-3 pt-2">
      {back && (
        <button
          aria-label="Volver"
          onClick={() => (typeof back === 'string' ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="-ml-2 mt-0.5 rounded-full p-2 text-ink-700 hover:bg-ink-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink-900 lg:text-3xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-ink-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
