import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteRow, RemoteTable, SyncRemote } from './remote';

const BUCKET = 'meal-photos';
const PAGE = 500;

interface Row {
  id?: string;
  user_id: string;
  date?: string;
  data: unknown;
  deleted?: boolean;
  photo_path?: string | null;
  updated_at: string;
  server_updated_at: string;
}

const idColumn = (t: RemoteTable) => (t === 'profiles' ? 'user_id' : 'id');

/** Implementación de SyncRemote sobre Supabase (Postgres + Storage). */
export class SupabaseRemote implements SyncRemote {
  constructor(
    private readonly sb: SupabaseClient,
    readonly userId: string,
  ) {}

  async pull<T>(table: RemoteTable, cursor: string): Promise<RemoteRow<T>[]> {
    const out: RemoteRow<T>[] = [];
    let from = 0;
    for (;;) {
      const { data, error } = await this.sb
        .from(table)
        .select('*')
        .gt('server_updated_at', cursor)
        .order('server_updated_at', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      for (const r of rows) {
        out.push({
          id: table === 'profiles' ? r.user_id : (r.id as string),
          data: r.data as T,
          deleted: !!r.deleted,
          updatedAt: Date.parse(r.updated_at),
          serverUpdatedAt: r.server_updated_at,
          photoPath: r.photo_path,
          date: r.date,
        });
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  async versions(table: RemoteTable, ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const col = idColumn(table);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data, error } = await this.sb.from(table).select(`${col}, updated_at`).in(col, chunk);
      if (error) throw new Error(error.message);
      for (const r of (data ?? []) as unknown as Record<string, string>[]) map.set(r[col], Date.parse(r.updated_at));
    }
    return map;
  }

  async push<T>(table: RemoteTable, rows: Omit<RemoteRow<T>, 'serverUpdatedAt'>[]): Promise<void> {
    const payload = rows.map((r) => {
      const base = { user_id: this.userId, data: r.data, updated_at: new Date(r.updatedAt).toISOString() };
      if (table === 'profiles') return base;
      if (table === 'custom_foods') return { ...base, id: r.id, deleted: r.deleted };
      return { ...base, id: r.id, date: r.date, deleted: r.deleted, photo_path: r.photoPath ?? null };
    });
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await this.sb
        .from(table)
        .upsert(payload.slice(i, i + 200), { onConflict: table === 'custom_foods' ? 'user_id,id' : idColumn(table) });
      if (error) throw new Error(error.message);
    }
  }

  async uploadPhoto(path: string, blob: Blob): Promise<void> {
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) throw new Error(`Error al subir la foto: ${error.message}`);
  }

  async downloadPhoto(path: string): Promise<Blob | null> {
    const { data, error } = await this.sb.storage.from(BUCKET).download(path);
    if (error) return null;
    return data;
  }

  async deletePhoto(path: string): Promise<void> {
    await this.sb.storage.from(BUCKET).remove([path]);
  }
}
