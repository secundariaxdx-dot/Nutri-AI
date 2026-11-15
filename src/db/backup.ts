/**
 * Exportación e importación de copias de seguridad en JSON.
 * Las fotos se incluyen opcionalmente como data URLs (base64).
 */
import { APP_VERSION } from '@/config/app';
import { blobToDataUrl, dataUrlToBlob } from '@/lib/image';
import type { CustomFood, Meal, Profile, WeightEntry } from '@/types';
import { db } from './database';

export const BACKUP_FORMAT = 'nutri-ai-backup';
export const BACKUP_VERSION = 1;

type SerializedMeal = Omit<Meal, 'photo' | 'thumb'> & { photo?: string; thumb?: string };

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  appVersion: string;
  exportedAt: string;
  profile?: Profile;
  meals: SerializedMeal[];
  customFoods: CustomFood[];
  weights: WeightEntry[];
}

export async function createBackup(includePhotos: boolean): Promise<Backup> {
  const [meals, profile, customFoods, weights] = await Promise.all([
    db.meals.toArray(),
    db.profile.get('me'),
    db.customFoods.toArray(),
    db.weights.toArray(),
  ]);
  const serialized: SerializedMeal[] = [];
  for (const m of meals) {
    if (m.deleted) continue;
    const { photo, thumb, ...rest } = m;
    const out: SerializedMeal = { ...rest };
    if (includePhotos) {
      if (photo) out.photo = await blobToDataUrl(photo);
      if (thumb) out.thumb = await blobToDataUrl(thumb);
    }
    serialized.push(out);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    profile,
    meals: serialized,
    customFoods: customFoods.filter((f) => !f.deleted),
    weights,
  };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const b = data as Partial<Backup>;
  if (b.format !== BACKUP_FORMAT || !Array.isArray(b.meals)) {
    throw new Error('El archivo no es una copia de seguridad de Nutri AI.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error('La copia procede de una versión más reciente de Nutri AI.');
  }
  for (const m of b.meals) {
    if (typeof m.id !== 'string' || typeof m.date !== 'string' || !Array.isArray(m.items)) {
      throw new Error('La copia contiene comidas con un formato no válido.');
    }
  }
  return { customFoods: [], weights: [], ...b } as Backup;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

/**
 * Importa una copia. En modo "merge" se conserva la versión más reciente de
 * cada comida (por updatedAt); en modo "replace" se borra todo antes.
 */
export async function importBackup(backup: Backup, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
  const meals: Meal[] = [];
  for (const m of backup.meals) {
    const { photo, thumb, ...rest } = m;
    meals.push({
      ...rest,
      deleted: 0,
      dirty: 1,
      origin: rest.origin ?? 'importado',
      photo: photo ? await dataUrlToBlob(photo) : undefined,
      thumb: thumb ? await dataUrlToBlob(thumb) : undefined,
    } as Meal);
  }
  await db.transaction('rw', [db.meals, db.profile, db.customFoods, db.weights], async () => {
    if (mode === 'replace') {
      await Promise.all([db.meals.clear(), db.customFoods.clear(), db.weights.clear()]);
    }
    for (const m of meals) {
      const prev = await db.meals.get(m.id);
      if (!prev) {
        await db.meals.put(m);
        result.added++;
      } else if (m.updatedAt > prev.updatedAt || prev.deleted) {
        await db.meals.put(m);
        result.updated++;
      } else result.skipped++;
    }
    for (const f of backup.customFoods ?? []) {
      const prev = await db.customFoods.get(f.id);
      if (!prev || f.updatedAt > prev.updatedAt) await db.customFoods.put({ ...f, dirty: 1, deleted: 0 });
    }
    for (const w of backup.weights ?? []) await db.weights.put(w);
    if (backup.profile) {
      const prev = await db.profile.get('me');
      if (mode === 'replace' || !prev || backup.profile.updatedAt > prev.updatedAt) {
        await db.profile.put({ ...backup.profile, id: 'me', dirty: 1 });
      }
    }
  });
  return result;
}

/** Elimina TODOS los datos locales (comidas, perfil, alimentos, ajustes). */
export async function wipeAllData() {
  await db.transaction('rw', [db.meals, db.profile, db.customFoods, db.weights, db.settings, db.recentFoods], async () => {
    await Promise.all([db.meals.clear(), db.profile.clear(), db.customFoods.clear(), db.weights.clear(), db.settings.clear(), db.recentFoods.clear()]);
  });
  try {
    if ('caches' in self) await caches.delete('transformers-cache');
  } catch {
    /* sin caché */
  }
}
