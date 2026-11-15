interface Props<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label, className = '' }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex rounded-2xl bg-ink-100 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? 'bg-white text-brand-900 shadow-sm' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
