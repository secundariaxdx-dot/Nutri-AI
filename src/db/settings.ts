import { db } from './database';

export interface AppSettings {
  visionModel: string;
  /** Si es false, no se descarga el modelo y se usa entrada manual. */
  aiEnabled: boolean;
  usdaApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncEnabled: boolean;
  syncPhotos: boolean;
  lastSyncAt: number;
  lastPulledAt: string;
  onboardingDone: boolean;
  installHintDismissed: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  visionModel: 'mobileclip-s0',
  aiEnabled: true,
  usdaApiKey: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  syncEnabled: false,
  syncPhotos: true,
  lastSyncAt: 0,
  lastPulledAt: '1970-01-01T00:00:00.000Z',
  onboardingDone: false,
  installHintDismissed: false,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray();
  const out: AppSettings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in out) (out as unknown as Record<string, unknown>)[r.key] = r.value;
  }
  return out;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  await db.settings.put({ key, value });
}

export async function setSettings(patch: Partial<AppSettings>) {
  await db.settings.bulkPut(Object.entries(patch).map(([key, value]) => ({ key, value })));
}
