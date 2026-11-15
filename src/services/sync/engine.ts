/**
 * Motor de sincronización local-first.
 *
 * - Cada registro local lleva `updatedAt` y `dirty`.
 * - PUSH: se suben los registros con dirty=1. Si el servidor tiene una versión
 *   más reciente (otro dispositivo), NO se sobrescribe: gana la última
 *   modificación (last-write-wins) y se descargará en el PULL.
 * - PULL: se descargan los cambios posteriores al último cursor del servidor.
 *   Un cambio remoto no pisa un cambio local pendiente más reciente.
 * - Los borrados se propagan como "lápidas" (deleted=1), así no reaparecen.
 * - Los ids son UUID, por lo que no se generan duplicados entre dispositivos.
 */
import { db } from '@/db/database';
import type { CustomFood, Meal, Profile } from '@/types';
import type { RemoteRow, SyncRemote } from './remote';

export interface SyncReport {
  pushed: number;
  pulled: number;
  conflicts: number;
  photosUploaded: number;
  photosDownloaded: number;
  cursor: string;
}

type MealData = Omit<Meal, 'photo' | 'thumb' | 'dirty'>;

/** Decide qué versión conservar. Devuelve true si gana la versión remota. */
export function remoteWins(local: { updatedAt: number; dirty?: number } | undefined, remoteUpdatedAt: number): boolean {
  if (!local) return true;
  // Sin cambios locales pendientes, el servidor es la fuente de verdad.
  if (!local.dirty) return true;
  // Con cambios pendientes, gana la modificación más reciente.
  return remoteUpdatedAt > local.updatedAt;
}

function mealToData(m: Meal): MealData {
  const { photo: _p, thumb: _t, dirty: _d, ...rest } = m;
  return rest;
}

async function makeThumb(blob: Blob): Promise<Blob | undefined> {
  try {
    const { processPhoto } = await import('@/lib/image');
    return (await processPhoto(blob)).thumb;
  } catch {
    return undefined;
  }
}

export interface SyncOptions {
  cursor: string;
  syncPhotos: boolean;
  onProgress?: (msg: string) => void;
}

export async function runSync(remote: SyncRemote, opts: SyncOptions): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, photosUploaded: 0, photosDownloaded: 0, cursor: opts.cursor };

  // ───────────── PUSH: comidas ─────────────
  opts.onProgress?.('Subiendo cambios…');
  const dirtyMeals = await db.meals.where('dirty').equals(1).toArray();
  if (dirtyMeals.length) {
    const versions = await remote.versions('meals', dirtyMeals.map((m) => m.id));
    const rows: Omit<RemoteRow<MealData>, 'serverUpdatedAt'>[] = [];
    for (const m of dirtyMeals) {
      const rv = versions.get(m.id);
      if (rv !== undefined && rv > m.updatedAt) {
        report.conflicts++;
        continue; // el servidor tiene una versión más nueva: se descargará después
      }
      let photoPath = m.photoPath ?? null;
      if (m.deleted && photoPath) {
        await remote.deletePhoto(photoPath).catch(() => undefined);
        photoPath = null;
      } else if (opts.syncPhotos && m.photo && !photoPath) {
        photoPath = `${remote.userId}/${m.id}.jpg`;
        await remote.uploadPhoto(photoPath, m.photo);
        report.photosUploaded++;
      }
      rows.push({ id: m.id, date: m.date, data: { ...mealToData(m), photoPath: photoPath ?? undefined }, deleted: !!m.deleted, updatedAt: m.updatedAt, photoPath });
    }
    if (rows.length) await remote.push('meals', rows);
    await db.transaction('rw', db.meals, async () => {
      for (const r of rows) {
        const cur = await db.meals.get(r.id);
        // Solo se limpia el flag si no se ha vuelto a modificar durante la subida.
        if (cur && cur.updatedAt === r.updatedAt) await db.meals.update(r.id, { dirty: 0, photoPath: r.photoPath ?? undefined });
      }
    });
    report.pushed += rows.length;
  }

  // ───────────── PUSH: alimentos personalizados ─────────────
  const dirtyFoods = await db.customFoods.where('dirty').equals(1).toArray();
  if (dirtyFoods.length) {
    const versions = await remote.versions('custom_foods', dirtyFoods.map((f) => f.id));
    const rows = dirtyFoods
      .filter((f) => {
        const rv = versions.get(f.id);
        if (rv !== undefined && rv > f.updatedAt) {
          report.conflicts++;
          return false;
        }
        return true;
      })
      .map((f) => {
        const { dirty: _d, ...data } = f;
        return { id: f.id, data, deleted: !!f.deleted, updatedAt: f.updatedAt };
      });
    if (rows.length) await remote.push('custom_foods', rows);
    for (const r of rows) {
      const cur = await db.customFoods.get(r.id);
      if (cur && cur.updatedAt === r.updatedAt) await db.customFoods.update(r.id, { dirty: 0 });
    }
    report.pushed += rows.length;
  }

  // ───────────── PUSH: perfil ─────────────
  const profile = await db.profile.get('me');
  if (profile?.dirty) {
    const versions = await remote.versions('profiles', [remote.userId]);
    const rv = versions.get(remote.userId);
    if (rv !== undefined && rv > profile.updatedAt) report.conflicts++;
    else {
      const { dirty: _d, ...data } = profile;
      await remote.push('profiles', [{ id: remote.userId, data, deleted: false, updatedAt: profile.updatedAt }]);
      const cur = await db.profile.get('me');
      if (cur && cur.updatedAt === profile.updatedAt) await db.profile.update('me', { dirty: 0 });
      report.pushed++;
    }
  }

  // ───────────── PULL ─────────────
  opts.onProgress?.('Descargando cambios…');
  let maxCursor = opts.cursor;
  const bump = (c: string) => {
    if (c > maxCursor) maxCursor = c;
  };

  const remoteMeals = await remote.pull<MealData>('meals', opts.cursor);
  for (const r of remoteMeals) {
    bump(r.serverUpdatedAt);
    const local = await db.meals.get(r.id);
    if (!remoteWins(local, r.updatedAt)) continue;
    if (local && local.updatedAt === r.updatedAt && !local.dirty) continue; // ya estaba al día
    let photo = local?.photo;
    let thumb = local?.thumb;
    const path = r.photoPath ?? undefined;
    if (r.deleted) {
      photo = thumb = undefined;
    } else if (path && (!photo || local?.photoPath !== path) && opts.syncPhotos) {
      const blob = await remote.downloadPhoto(path).catch(() => null);
      if (blob) {
        photo = blob;
        thumb = await makeThumb(blob);
        report.photosDownloaded++;
      }
    }
    const meal: Meal = {
      ...(r.data as MealData),
      id: r.id,
      deleted: r.deleted ? 1 : 0,
      updatedAt: r.updatedAt,
      photoPath: path,
      photo,
      thumb,
      dirty: 0,
    };
    await db.meals.put(meal);
    report.pulled++;
  }

  const remoteFoods = await remote.pull<Omit<CustomFood, 'dirty'>>('custom_foods', opts.cursor);
  for (const r of remoteFoods) {
    bump(r.serverUpdatedAt);
    const local = await db.customFoods.get(r.id);
    if (!remoteWins(local, r.updatedAt)) continue;
    await db.customFoods.put({ ...(r.data as CustomFood), id: r.id, deleted: r.deleted ? 1 : 0, updatedAt: r.updatedAt, dirty: 0 });
    report.pulled++;
  }

  const remoteProfiles = await remote.pull<Omit<Profile, 'dirty'>>('profiles', opts.cursor);
  for (const r of remoteProfiles) {
    bump(r.serverUpdatedAt);
    const local = await db.profile.get('me');
    if (!remoteWins(local, r.updatedAt)) continue;
    await db.profile.put({ ...(r.data as Profile), id: 'me', updatedAt: r.updatedAt, dirty: 0 });
    report.pulled++;
  }

  report.cursor = maxCursor;
  return report;
}
