import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { saveMeal, deleteMeal, getMeal } from '@/db/meals';
import { wipeAllData } from '@/db/backup';
import { itemFromFood } from '@/ai/analyze';
import { getFood } from '@/lib/foodDatabase';
import { remoteWins, runSync } from './engine';
import type { RemoteRow, RemoteTable, SyncRemote } from './remote';

/** Servidor en memoria que imita a Supabase (incluido server_updated_at). */
class MemoryRemote implements SyncRemote {
  userId = 'user-1';
  tables: Record<RemoteTable, Map<string, RemoteRow<unknown>>> = { meals: new Map(), custom_foods: new Map(), profiles: new Map() };
  clock = 0;
  photos = new Map<string, Blob>();
  private now() {
    return new Date(Date.UTC(2026, 0, 1) + ++this.clock * 1000).toISOString();
  }
  async pull<T>(t: RemoteTable, cursor: string) {
    return [...this.tables[t].values()].filter((r) => r.serverUpdatedAt > cursor).sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt)) as RemoteRow<T>[];
  }
  async versions(t: RemoteTable, ids: string[]) {
    const m = new Map<string, number>();
    for (const id of ids) {
      const r = this.tables[t].get(id);
      if (r) m.set(id, r.updatedAt);
    }
    return m;
  }
  async push<T>(t: RemoteTable, rows: Omit<RemoteRow<T>, 'serverUpdatedAt'>[]) {
    for (const r of rows) this.tables[t].set(r.id, { ...r, serverUpdatedAt: this.now() } as RemoteRow<unknown>);
  }
  async uploadPhoto(path: string, blob: Blob) {
    this.photos.set(path, blob);
  }
  async downloadPhoto(path: string) {
    return this.photos.get(path) ?? null;
  }
  async deletePhoto(path: string) {
    this.photos.delete(path);
  }
}

const meal = (date = '2026-01-10') => ({
  date,
  mealType: 'comida' as const,
  time: '13:00',
  name: 'Test',
  items: [itemFromFood(getFood('manzana')!, 180)],
  origin: 'manual' as const,
});

const EPOCH = '1970-01-01T00:00:00.000Z';

beforeEach(async () => {
  await wipeAllData();
});

describe('remoteWins', () => {
  it('last-write-wins solo cuando hay cambios locales', () => {
    expect(remoteWins(undefined, 1)).toBe(true);
    expect(remoteWins({ updatedAt: 10, dirty: 0 }, 5)).toBe(true);
    expect(remoteWins({ updatedAt: 10, dirty: 1 }, 5)).toBe(false);
    expect(remoteWins({ updatedAt: 10, dirty: 1 }, 20)).toBe(true);
  });
});

describe('motor de sincronización', () => {
  it('sube cambios pendientes y limpia el indicador', async () => {
    const remote = new MemoryRemote();
    const m = await saveMeal(meal());
    const r = await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    expect(r.pushed).toBe(1);
    expect(remote.tables.meals.get(m.id)).toBeDefined();
    expect((await db.meals.get(m.id))!.dirty).toBe(0);
  });

  it('descarga en otro dispositivo sin duplicar en sincronizaciones repetidas', async () => {
    const remote = new MemoryRemote();
    const m = await saveMeal(meal());
    const r1 = await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    // "Otro dispositivo": base de datos vacía
    await wipeAllData();
    const r2 = await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    expect(r2.pulled).toBe(1);
    expect(await getMeal(m.id)).toBeDefined();
    const r3 = await runSync(remote, { cursor: r2.cursor, syncPhotos: false });
    expect(r3.pulled).toBe(0);
    expect(await db.meals.count()).toBe(1);
    expect(r1.cursor <= r2.cursor).toBe(true);
  });

  it('resuelve conflictos: gana la modificación más reciente', async () => {
    const remote = new MemoryRemote();
    const m = await saveMeal(meal());
    await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    // El servidor recibe una versión más nueva de otro dispositivo
    const row = remote.tables.meals.get(m.id)!;
    await remote.push('meals', [{ ...row, data: { ...(row.data as object), name: 'Remota' }, updatedAt: m.updatedAt + 100000 }]);
    // Cambio local más antiguo pendiente
    await db.meals.update(m.id, { name: 'Local', dirty: 1, updatedAt: m.updatedAt + 10 });
    const r = await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    expect(r.conflicts).toBe(1);
    expect((await db.meals.get(m.id))!.name).toBe('Remota');
  });

  it('un cambio local más reciente no se pisa', async () => {
    const remote = new MemoryRemote();
    const m = await saveMeal(meal());
    await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    await db.meals.update(m.id, { name: 'Local nuevo', dirty: 1, updatedAt: m.updatedAt + 50000 });
    await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    expect((remote.tables.meals.get(m.id)!.data as { name: string }).name).toBe('Local nuevo');
    expect((await db.meals.get(m.id))!.name).toBe('Local nuevo');
  });

  it('propaga borrados y sube fotos', async () => {
    const remote = new MemoryRemote();
    const m = await saveMeal({ ...meal(), photo: new Blob(['x'], { type: 'image/jpeg' }) });
    await runSync(remote, { cursor: EPOCH, syncPhotos: true });
    expect(remote.photos.size).toBe(1);
    await deleteMeal(m.id);
    await runSync(remote, { cursor: EPOCH, syncPhotos: true });
    expect(remote.tables.meals.get(m.id)!.deleted).toBe(true);
    expect(remote.photos.size).toBe(0);
  });

  it('sincroniza el perfil', async () => {
    const remote = new MemoryRemote();
    await db.profile.put({ id: 'me', sex: 'mujer', activity: 'ligero', goal: 'mantener', autoGoals: false, goals: { kcal: 1900, protein: 90, carbs: 200, fat: 60, fiber: 25 }, updatedAt: 5, dirty: 1 });
    await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    await wipeAllData();
    await runSync(remote, { cursor: EPOCH, syncPhotos: false });
    expect((await db.profile.get('me'))!.goals.kcal).toBe(1900);
  });
});
