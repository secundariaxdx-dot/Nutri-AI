import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "sheet" se ancla abajo en móvil (estilo iOS). */
  variant?: 'sheet' | 'dialog';
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ open, onClose, title, children, footer, variant = 'sheet', size = 'md' }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    setTimeout(() => panel.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-ink-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92dvh] w-full flex-col bg-white shadow-lift outline-none ${width} ${
          variant === 'sheet' ? 'animate-slide-up rounded-t-4xl sm:rounded-4xl' : 'mx-4 mb-[30vh] animate-scale-in rounded-4xl sm:mb-0'
        }`}
      >
        {variant === 'sheet' && <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-ink-200 sm:hidden" />}
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-2 pt-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button aria-label="Cerrar" onClick={onClose} className="-mr-2 rounded-full p-2 text-ink-500 hover:bg-ink-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-ink-100 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
