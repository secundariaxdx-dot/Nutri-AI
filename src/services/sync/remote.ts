/**
 * Abstracción del servidor remoto. El motor de sincronización solo conoce esta
 * interfaz, lo que permite probarlo con un servidor en memoria y, en el
 * futuro, cambiar Supabase por otro backend.
 */
export interface RemoteRow<T> {
  id: string;
  data: T;
  deleted: boolean;
  updatedAt: number; // ms (hora del dispositivo que lo escribió)
  serverUpdatedAt: string; // ISO (hora del servidor)
  photoPath?: string | null;
  date?: string;
}

export type RemoteTable = 'meals' | 'custom_foods' | 'profiles';

export interface SyncRemote {
  userId: string;
  /** Devuelve filas modificadas en el servidor después de `cursor`. */
  pull<T>(table: RemoteTable, cursor: string): Promise<RemoteRow<T>[]>;
  /** updatedAt (ms) actual en el servidor para los ids dados. */
  versions(table: RemoteTable, ids: string[]): Promise<Map<string, number>>;
  push<T>(table: RemoteTable, rows: Omit<RemoteRow<T>, 'serverUpdatedAt'>[]): Promise<void>;
  uploadPhoto(path: string, blob: Blob): Promise<void>;
  downloadPhoto(path: string): Promise<Blob | null>;
  deletePhoto(path: string): Promise<void>;
}
