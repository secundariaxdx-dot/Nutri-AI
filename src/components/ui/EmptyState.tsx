import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex animate-fade-in flex-col items-center px-6 py-10 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-brand-100/60 blur-xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-brand-200">
          <Icon className="h-8 w-8 text-brand-700" strokeWidth={1.6} />
        </div>
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
