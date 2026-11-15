import { UtensilsCrossed } from 'lucide-react';
import { useObjectUrl } from '@/hooks/useObjectUrl';

export function MealPhoto({ blob, alt, className = 'h-14 w-14' }: { blob?: Blob; alt: string; className?: string }) {
  const url = useObjectUrl(blob);
  if (!url) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 ${className}`}>
        <UtensilsCrossed className="h-1/2 w-1/2 max-h-6 max-w-6 text-brand-600" strokeWidth={1.7} aria-hidden />
      </div>
    );
  }
  return <img src={url} alt={alt} className={`shrink-0 rounded-2xl object-cover ${className}`} />;
}
