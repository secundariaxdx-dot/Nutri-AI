import { useEffect, useState } from 'react';

interface Props {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  placeholder?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
  allowEmpty?: boolean;
}

/** Campo numérico que acepta coma decimal (teclados en español). */
export function NumberInput({ value, onChange, min, max, step, id, placeholder, suffix, className = '', ariaLabel, allowEmpty = true }: Props) {
  const [text, setText] = useState(value === undefined ? '' : String(value).replace('.', ','));
  useEffect(() => {
    const parsed = Number(text.replace(',', '.'));
    if (value !== parsed && !(value === undefined && text === '')) setText(value === undefined ? '' : String(value).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const invalid = text !== '' && (!Number.isFinite(Number(text.replace(',', '.'))) || (min !== undefined && Number(text.replace(',', '.')) < min) || (max !== undefined && Number(text.replace(',', '.')) > max));

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={`input ${suffix ? "pr-9" : ""} ${invalid ? 'ring-red-400 focus:ring-red-500' : ''}`}
        placeholder={placeholder}
        value={text}
        step={step}
        onChange={(e) => {
          const t = e.target.value.replace(/[^\d.,]/g, '');
          setText(t);
          if (t === '') return allowEmpty ? onChange(undefined) : undefined;
          const n = Number(t.replace(',', '.'));
          if (Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-400">{suffix}</span>}
    </div>
  );
}
