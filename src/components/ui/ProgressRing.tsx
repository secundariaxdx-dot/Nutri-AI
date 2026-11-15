import type { ReactNode } from 'react';

interface Props {
  value: number; // 0–1 (puede superar 1)
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
  label?: string;
}

/** Indicador circular animado. Si se supera el objetivo, el exceso se marca en ámbar. */
export function ProgressRing({ value, size = 180, stroke = 14, color = '#1f7c4e', track = '#e8efe9', children, label }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const main = Math.min(1, Math.max(0, value));
  const over = Math.min(1, Math.max(0, value - 1));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - main)}
          style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
        />
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#e8a838"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - over)}
            style={{ transition: 'stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)' }}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
