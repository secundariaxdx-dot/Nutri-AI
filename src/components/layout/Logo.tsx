export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="nl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1f7c4e" />
          <stop offset="1" stopColor="#13412e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#nl)" />
      <path d="M44 16c-15 0-25 9-25 22 0 3 .6 5.5 1.7 7.6C24 33 33 26 42 24c-8 4-15 11-18 23 2 1.2 4.6 1.9 7.6 1.9C44 49 50 37 50 22c0-2-.2-4-.6-6H44Z" fill="#b3e5c6" />
      <circle cx="46" cy="44" r="3.2" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <div className="text-[17px] font-extrabold tracking-tight text-brand-950">
          NUTRI <span className="text-brand-600">AI</span>
        </div>
        <div className="mt-0.5 text-[11px] font-medium text-ink-500">Nutrición inteligente</div>
      </div>
    </div>
  );
}
