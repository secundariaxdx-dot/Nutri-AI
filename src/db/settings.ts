import { DEFAULT_GEMINI_MODEL, DEFAULT_PERSONAL_LIMITS } from '@/config/aiProviders';
import { db } from './database';

export interface AppSettings {
  /** Modelo LOCAL (MobileCLIP / CLIP). */
  visionModel: string;
  /** Proveedor de IA para fotos: gemini | local | azure | manual. */
  aiProvider: 'gemini' | 'local' | 'azure' | 'manual';
  geminiApiKey: string;
  geminiModel: string;
  /** El usuario ha leído y aceptado las condiciones del nivel gratuito de Gemini. */
  geminiTermsAccepted: boolean;
  azureEndpoint: string;
  azureDeployment: string;
  azureApiKey: string;
  azureAcknowledgedCredit: boolean;
  /** Límites PERSONALES (no son los oficiales del proveedor). */
  aiDailyLimit: number;
  aiMonthlyLimit: number;
  aiWarnPercent: number;
  aiBlockAtLimit: boolean;
  /** Límite diario oficial que el usuario ve en AI Studio (opcional, manual). */
  providerDailyLimit: number;
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
  // Hasta que se configure una clave, se usa el modelo local (comportamiento anterior).
  aiProvider: 'local',
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  geminiTermsAccepted: false,
  azureEndpoint: '',
  azureDeployment: '',
  azureApiKey: '',
  azureAcknowledgedCredit: false,
  aiDailyLimit: DEFAULT_PERSONAL_LIMITS.daily,
  aiMonthlyLimit: DEFAULT_PERSONAL_LIMITS.monthly,
  aiWarnPercent: DEFAULT_PERSONAL_LIMITS.warnAtPercent,
  aiBlockAtLimit: DEFAULT_PERSONAL_LIMITS.blockAtLimit,
  providerDailyLimit: 0,
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
