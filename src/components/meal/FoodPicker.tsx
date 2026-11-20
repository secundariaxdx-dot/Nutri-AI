import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Database, Globe, PackagePlus, Search, WifiOff } from 'lucide-react';
import { CATEGORY_LABEL, PREPARATION_LABEL } from '@/config/app';
import { saveCustomFood } from '@/db/customFoods';
import { useSettings } from '@/hooks/useData';
import { useOnline } from '@/hooks/useOnline';
import { getAllFoods } from '@/lib/foodDatabase';
import { formatKcal } from '@/lib/format';
import { getRecentFoods, searchOffline, searchOnline } from '@/services/foodSearch';
import type { Food, FoodCategory, FoodSearchResult } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { AmountStep } from './AmountStep';
import { SourceBadge } from './SourceBadge';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (food: Food, grams: number) => void;
  /** Texto con el que empezar la búsqueda (p. ej. un alimento detectado sin datos). */
  initialQuery?: string;
}

const CATEGORIES: FoodCategory[] = ['carnes', 'pescados', 'huevos', 'cereales', 'legumbres', 'verduras', 'frutas', 'lacteos', 'frutos-secos', 'grasas', 'salsas', 'dulces', 'bebidas', 'platos'];

/** Buscador de alimentos: base local + mis alimentos + Open Food Facts + USDA. */
export function FoodPicker({ open, onClose, onPick, initialQuery }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [online, setOnlineResults] = useState<FoodSearchResult[] | null>(null);
  const [onlineSource, setOnlineSource] = useState<'off' | 'usda' | null>(null);
  const [loadingOnline, setLoadingOnline] = useState(false);
  const [onlineError, setOnlineError] = useState<string>();
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [recent, setRecent] = useState<{ food: Food; lastGrams?: number }[]>([]);
  const [selected, setSelected] = useState<{ food: Food; grams?: number } | null>(null);
  const settings = useSettings();
  const isOnline = useOnline();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController>();

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery ?? '');
    setSelected(null);
    setCategory(null);
    setOnlineResults(null);
    setOnlineError(undefined);
    getRecentFoods(10).then(setRecent);
    setTimeout(() => input.current?.focus(), 150);
  }, [open, initialQuery]);

  useEffect(() => {
    let alive = true;
    setOnlineResults(null);
    setOnlineError(undefined);
    abort.current?.abort();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchOffline(query).then((r) => alive && setResults(r));
    return () => {
      alive = false;
    };
  }, [query]);

  const byCategory = useMemo(() => (category ? getAllFoods().filter((f) => f.category === category) : []), [category]);

  const runOnline = async (source: 'off' | 'usda') => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setOnlineSource(source);
    setLoadingOnline(true);
    setOnlineError(undefined);
    try {
      const r = await searchOnline(query.trim(), source, settings.usdaApiKey, ctrl.signal);
      setOnlineResults(r);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setOnlineError((e as Error).message);
    } finally {
      setLoadingOnline(false);
    }
  };

  const choose = async (food: Food, grams?: number) => setSelected({ food, grams });

  const confirm = async (grams: number) => {
    if (!selected) return;
    let food = selected.food;
    // Los alimentos obtenidos en línea se guardan en "Mis alimentos" para usarlos sin conexión.
    if (food.id.startsWith('off:') || food.id.startsWith('usda:')) {
      try {
        food = await saveCustomFood({ ...food, id: food.id });
      } catch {
        /* si falla el guardado se usa igualmente */
      }
    }
    onPick(food, grams);
    onClose();
  };

  const row = (food: Food, origin?: FoodSearchResult['origin'], grams?: number) => (
    <li key={`${origin}-${food.id}`}>
      <button onClick={() => choose(food, grams)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-ink-50">
        {food.imageUrl ? (
          <img src={food.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-xl bg-ink-50 object-contain" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700">
            {food.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-medium text-ink-900">{food.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
            {food.brand && <span className="truncate">{food.brand}</span>}
            {food.preparation && <span className="chip bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">{PREPARATION_LABEL[food.preparation]}</span>}
            {origin && origin !== 'local' && <SourceBadge source={food.source} />}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">{formatKcal(food.nutrients.kcal)}</div>
          <div className="text-[11px] text-ink-400">kcal/100 g</div>
        </div>
      </button>
    </li>
  );

  return (
    <Modal open={open} onClose={onClose} title={selected ? 'Cantidad' : 'Añadir alimento'} size="lg">
      {selected ? (
        <AmountStep food={selected.food} initialGrams={selected.grams} onBack={() => setSelected(null)} onConfirm={confirm} />
      ) : (
        <div>
          <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-400" />
              <input
                ref={input}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca: pechuga de pollo, arroz cocido…"
                className="input pl-12"
                aria-label="Buscar alimento"
                enterKeyHint="search"
              />
            </div>
          </div>

          {!query.trim() && (
            <>
              {recent.length > 0 && (
                <section className="mb-4">
                  <h3 className="section-title mb-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Recientes
                  </h3>
                  <ul>{recent.map((r) => row(r.food, 'local', r.lastGrams))}</ul>
                </section>
              )}
              <section>
                <h3 className="section-title mb-2">Explorar por categoría</h3>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(category === c ? null : c)}
                      className={`chip px-3 py-1.5 text-sm ${category === c ? 'bg-brand-900 text-white' : 'bg-ink-100 text-ink-700 hover:bg-ink-200'}`}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  ))}
                </div>
                {category && <ul className="mt-3">{byCategory.map((f) => row(f, 'local'))}</ul>}
              </section>
            </>
          )}

          {query.trim() && (
            <>
              <section>
                <h3 className="section-title mb-1 flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" /> En tu dispositivo
                </h3>
                {results.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-ink-500">No hay coincidencias en la base local. Prueba en línea o crea el alimento.</p>
                ) : (
                  <ul>{results.map((r) => row(r.food, r.origin))}</ul>
                )}
              </section>

              <section className="mt-4 rounded-3xl bg-ink-50 p-3">
                <h3 className="section-title mb-2 flex items-center gap-1.5 px-1">
                  <Globe className="h-3.5 w-3.5" /> Buscar en línea
                </h3>
                {!isOnline ? (
                  <p className="flex items-center gap-2 px-1 text-sm text-ink-500">
                    <WifiOff className="h-4 w-4" /> Sin conexión. Solo está disponible la base local.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn-secondary bg-white py-2.5 text-sm" onClick={() => runOnline('off')} disabled={loadingOnline}>
                      Open Food Facts
                    </button>
                    <button className="btn-secondary bg-white py-2.5 text-sm" onClick={() => runOnline('usda')} disabled={loadingOnline}>
                      USDA (en inglés)
                    </button>
                  </div>
                )}
                {loadingOnline && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-ink-500">
                    <Spinner /> Buscando en {onlineSource === 'off' ? 'Open Food Facts' : 'USDA'}…
                  </div>
                )}
                {onlineError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{onlineError}</p>}
                {online && !loadingOnline && (
                  <div className="mt-2">
                    {online.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-ink-500">
                        Sin resultados.{onlineSource === 'usda' && ' USDA funciona mejor con términos en inglés (p. ej. «chicken breast»).'}
                      </p>
                    ) : (
                      <ul className="rounded-2xl bg-white">{online.map((r) => row(r.food, r.origin))}</ul>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          <Link
            to="/alimento/nuevo"
            onClick={onClose}
            className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-ink-200 px-4 py-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <PackagePlus className="h-5 w-5 text-brand-700" />
            Crear un alimento con sus valores nutricionales
          </Link>
        </div>
      )}
    </Modal>
  );
}
