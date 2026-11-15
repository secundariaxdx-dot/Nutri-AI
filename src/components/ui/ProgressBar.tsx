interface Props {
  value: number; // 0–1+
  color?: string;
  className?: string;
  label?: string;
}

export function ProgressBar({ value, color = '#1f7c4e', className = '', label }: Props) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={`h-2 w-full overflow-hidden rounded-full bg-ink-100 ${className}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: value > 1.05 ? '#e8a838' : color, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }}
      />
    </div>
  );
}
