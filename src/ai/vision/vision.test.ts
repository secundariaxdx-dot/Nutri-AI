/**
 * Pruebas del nuevo sistema de visión (proveedor Gemini + validación + cruce
 * con la base de datos).
 *
 * IMPORTANTE: las respuestas del modelo de los casos 1–9 son SIMULADAS (escritas
 * a mano con el formato del esquema). Comprueban que la app interpreta, valida y
 * convierte correctamente una respuesta, NO la precisión real de Gemini, que no
 * se ha podido medir sin una clave de API.
 * El cuerpo de error del caso 10 es la respuesta REAL de Google a una clave no
 * válida (capturada el 20/11/2026).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiProvider, mapGeminiError } from '@/ai/providers/gemini';
import { AIError, QUOTA_MESSAGE, redactSecrets } from '@/ai/providers/errors';
import { runAnalysis } from '@/ai/providers';
import { buildAnalysisDraft, matchVisionFood } from './match';
import { parseVisionResponse, InvalidVisionResponseError, type VisionFood } from './schema';
import { itemsTotals } from '@/lib/nutrition';
import { getFood } from '@/lib/foodDatabase';
import { db } from '@/db/database';
import { DEFAULT_SETTINGS, type AppSettings } from '@/db/settings';
import { getUsageSummary } from '@/ai/usage';

const KEY = 'AIzaSyTEST_key_for_unit_tests_000000000';
const IMG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])], { type: 'image/jpeg' });

function geminiOk(payload: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] }), { status: 200 });
}
function geminiRaw(text: string) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }), { status: 200 });
}

const food = (f: Partial<VisionFood> & Pick<VisionFood, 'name' | 'confidence'>): VisionFood => ({
  catalog_id: null,
  search_terms: [],
  preparation: 'desconocida',
  quantity: null,
  unit: null,
  estimated_grams: 100,
  is_hypothesis: false,
  visual_evidence: 'test',
  ...f,
});

async function analyzeWith(payload: unknown) {
  const fetchMock = vi.fn(async () => geminiOk(payload));
  const p = new GeminiProvider(KEY, 'gemini-4-hydrogen', fetchMock as unknown as typeof fetch);
  const analysis = await p.analyze(IMG);
  return { analysis, draft: buildAnalysisDraft(analysis.foods), fetchMock };
}

describe('Petición a Gemini', () => {
  it('envía la clave en cabecera (no en la URL), la imagen en línea y el esquema JSON, sin temperature', async () => {
    const { fetchMock } = await analyzeWith({ contains_food: false, image_quality: 'buena', meal_description: '', foods: [], uncertainties: [] });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-4-hydrogen:generateContent');
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe('image/jpeg');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseJsonSchema.required).toContain('foods');
    expect(body.generationConfig.temperature).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toMatch(/No inventes ingredientes/);
  });
});

describe('Escenarios de reconocimiento (respuestas simuladas)', () => {
  it('1. Tostada de pan de payés con aceite y dos huevos', async () => {
    const { draft, analysis } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Tostada de pan de payés con dos huevos',
      foods: [
        food({ name: 'Tostada de pan de payés', catalog_id: 'pan-payes-tostado', preparation: 'tostado', quantity: 1, unit: 'rebanada', estimated_grams: 60, confidence: 0.93 }),
        food({ name: 'Huevo', search_terms: ['huevos'], quantity: 2, unit: 'unidad', estimated_grams: 110, confidence: 0.95, visual_evidence: 'Se observan dos huevos' }),
        food({ name: 'Aceite de oliva', estimated_grams: 10, confidence: 0.55, is_hypothesis: true, visual_evidence: 'Brillo compatible con aceite' }),
      ],
      uncertainties: ['La cantidad de aceite es estimada', 'No se distingue si los huevos están fritos o a la plancha'],
    });
    expect(analysis.uncertainties).toHaveLength(2);
    // Un único alimento de pan y UNA sola entrada de huevo (no varias preparaciones).
    expect(draft.items.map((i) => i.foodId)).toEqual(['pan-payes-tostado', 'huevo-cocido']);
    const huevo = draft.items[1];
    expect(huevo.grams).toBe(110);
    expect(huevo.preparationUnconfirmed).toBe(true);
    // El aceite es hipótesis: se ofrece, no se añade.
    expect(draft.suggestions.map((s) => s.food.id)).toEqual(['aceite-oliva']);
    // Nutrientes calculados con USDA: 60 g tostada (319 kcal/100) + 110 g huevo cocido (155 kcal/100)
    const kcal = itemsTotals(draft.items).values.kcal!;
    expect(kcal).toBeCloseTo(0.6 * getFood('pan-payes-tostado')!.nutrients.kcal! + 1.1 * getFood('huevo-cocido')!.nutrients.kcal!, 1);
  });

  it('2. Macarrones con tomate y queso', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Macarrones con salsa de tomate y queso rallado',
      foods: [
        food({ name: 'Macarrones cocidos', search_terms: ['pasta cocida'], preparation: 'cocido', estimated_grams: 220, confidence: 0.92 }),
        food({ name: 'Salsa de tomate', estimated_grams: 70, confidence: 0.85 }),
        food({ name: 'Queso parmesano rallado', search_terms: ['parmesano'], estimated_grams: 12, confidence: 0.7 }),
      ],
      uncertainties: ['El tipo de queso no se puede confirmar'],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['pasta-cocida', 'salsa-tomate', 'queso-parmesano']);
    expect(draft.items[0].preparation).toBe('cocido');
  });

  it('3. Arroz con pollo', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Arroz blanco con trozos de pollo',
      foods: [
        food({ name: 'Arroz blanco cocido', preparation: 'cocido', estimated_grams: 180, confidence: 0.9 }),
        food({ name: 'Pechuga de pollo a la plancha', preparation: 'plancha', estimated_grams: 120, confidence: 0.8 }),
      ],
      uncertainties: [],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['arroz-blanco-cocido', 'pollo-pechuga-plancha']);
    expect(draft.items.every((i) => !i.preparationUnconfirmed)).toBe(true);
  });

  it('4. Ensalada con atún', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Ensalada de lechuga, tomate y atún',
      foods: [
        food({ name: 'Lechuga', estimated_grams: 60, confidence: 0.9 }),
        food({ name: 'Tomate', estimated_grams: 80, confidence: 0.88 }),
        food({ name: 'Atún en lata', search_terms: ['atun'], estimated_grams: 50, confidence: 0.85 }),
        food({ name: 'Aceite de oliva', estimated_grams: 8, confidence: 0.4, is_hypothesis: true }),
      ],
      uncertainties: ['No se sabe si el atún es al natural o en aceite'],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['lechuga-romana', 'tomate', 'atun-lata-agua']);
    expect(draft.suggestions).toHaveLength(1);
  });

  it('5. Yogur con fruta', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Bol de yogur natural con fresas y arándanos',
      foods: [
        food({ name: 'Yogur natural', estimated_grams: 125, confidence: 0.9 }),
        food({ name: 'Fresas', estimated_grams: 60, confidence: 0.9 }),
        food({ name: 'Arándanos', estimated_grams: 30, confidence: 0.85 }),
      ],
      uncertainties: [],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['yogur-natural', 'fresas', 'arandanos']);
  });

  it('6. Patatas con huevos (fritos visibles)', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'buena',
      meal_description: 'Patatas fritas con dos huevos fritos',
      foods: [
        food({ name: 'Patatas fritas', preparation: 'frito', estimated_grams: 150, confidence: 0.9 }),
        food({ name: 'Huevo frito', preparation: 'frito', quantity: 2, estimated_grams: 100, confidence: 0.9 }),
      ],
      uncertainties: [],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['patatas-fritas', 'huevo-frito']);
    expect(draft.items[1].preparationUnconfirmed).toBeUndefined();
  });

  it('7. Plato con varios alimentos, duplicados y alimento sin datos', async () => {
    const { draft } = await analyzeWith({
      contains_food: true,
      image_quality: 'aceptable',
      meal_description: 'Plato combinado',
      foods: [
        food({ name: 'Filete de ternera a la plancha', preparation: 'plancha', estimated_grams: 150, confidence: 0.85 }),
        food({ name: 'Brócoli', preparation: 'cocido', estimated_grams: 80, confidence: 0.8 }),
        food({ name: 'Brócoli', preparation: 'cocido', estimated_grams: 40, confidence: 0.7 }),
        food({ name: 'Kimchi casero', estimated_grams: 40, confidence: 0.75 }),
        food({ name: 'Arroz cocido', preparation: 'cocido', estimated_grams: null, quantity: 1, confidence: 0.8 }),
      ],
      uncertainties: [],
    });
    expect(draft.items.map((i) => i.foodId)).toEqual(['filete-ternera-plancha', 'brocoli-cocido', 'arroz-blanco-cocido']);
    expect(draft.items[1].grams).toBe(120); // agrupado, no duplicado
    expect(draft.unmatched.map((u) => u.name)).toEqual(['Kimchi casero']); // sin datos: no se inventan
    expect(draft.items[2].defaultQuantity).toBe(true);
  });

  it('8. Fotografía poco clara: no inventa comida', async () => {
    const { draft, analysis } = await analyzeWith({
      contains_food: true,
      image_quality: 'mala',
      meal_description: '',
      foods: [food({ name: 'Algo parecido a pasta', estimated_grams: 100, confidence: 0.2, is_hypothesis: true })],
      uncertainties: ['La imagen está muy desenfocada'],
    });
    expect(analysis.image_quality).toBe('mala');
    expect(draft.items).toHaveLength(0);
  });

  it('9. Fotografía sin comida', async () => {
    const { draft, analysis } = await analyzeWith({ contains_food: false, image_quality: 'buena', meal_description: 'Un teclado', foods: [food({ name: 'X', confidence: 0.9 })], uncertainties: [] });
    expect(analysis.contains_food).toBe(false);
    expect(analysis.foods).toHaveLength(0);
    expect(draft.items).toHaveLength(0);
  });
});

describe('Errores del proveedor', () => {
  const provider = (impl: () => Promise<Response>) => new GeminiProvider(KEY, 'gemini-4-hydrogen', vi.fn(impl) as unknown as typeof fetch);

  it('10. API key inválida (respuesta real de Google)', async () => {
    const real = {
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com', metadata: { service: 'generativelanguage.googleapis.com' } },
          { '@type': 'type.googleapis.com/google.rpc.LocalizedMessage', locale: 'en-US', message: 'API key not valid. Please pass a valid API key.' },
        ],
      },
    };
    await expect(provider(async () => new Response(JSON.stringify(real), { status: 400 })).analyze(IMG)).rejects.toMatchObject({ code: 'invalid_key' });
    await expect(provider(async () => new Response(JSON.stringify(real), { status: 400 })).validate()).rejects.toMatchObject({ code: 'invalid_key' });
  });

  it('11. Cuota agotada (429): mensaje claro, diario/por minuto y modelo sin cuota gratuita', () => {
    const perDay = mapGeminiError(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] }] } }, 'gemini-4-hydrogen');
    expect(perDay.code).toBe('quota');
    expect(perDay.message.startsWith(QUOTA_MESSAGE)).toBe(true);
    expect(perDay.details.scope).toBe('day');
    const perMin = mapGeminiError(429, { error: { status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '17s' }] } }, 'm');
    expect(perMin.details).toMatchObject({ scope: 'minute', retryAfterSec: 17 });
    const noFree = mapGeminiError(429, { error: { status: 'RESOURCE_EXHAUSTED', message: 'limit: 0', details: [] } }, 'gemini-4-hydrogen');
    expect(noFree.details.noFreeQuota).toBe(true);
    expect(noFree.message).toMatch(/no tiene cuota gratuita/);
  });

  it('12. Error de red', async () => {
    await expect(provider(async () => Promise.reject(new TypeError('Failed to fetch'))).analyze(IMG)).rejects.toMatchObject({ code: 'network' });
  });

  it('13. Respuesta JSON inválida: recuperación controlada o error sin guardar nada', async () => {
    // Recuperable: JSON envuelto en un bloque de código y con números como texto.
    const wrapped = '```json\n{"contains_food":true,"image_quality":"buena","meal_description":"Plátano","foods":[{"name":"Plátano","preparation":"crudo","estimated_grams":"120","confidence":"0,9","is_hypothesis":false,"visual_evidence":"un plátano"}],"uncertainties":[]}\n```';
    const ok = await provider(async () => geminiRaw(wrapped)).analyze(IMG);
    expect(ok.foods[0]).toMatchObject({ name: 'Plátano', estimated_grams: 120, confidence: 0.9 });
    // No recuperable
    await expect(provider(async () => geminiRaw('Lo siento, no puedo ayudar con eso')).analyze(IMG)).rejects.toMatchObject({ code: 'invalid_response' });
    // Estructura incorrecta
    expect(() => parseVisionResponse({ foods: 'no' })).toThrow(InvalidVisionResponseError);
    // Elemento inválido descartado con aviso (confianza fuera de rango), el resto se conserva
    const partial = parseVisionResponse({ contains_food: true, foods: [{ name: 'Pan', estimated_grams: 50, confidence: 7, preparation: 'tostado' }, { name: 'Huevo', estimated_grams: 55, confidence: 0.9 }] });
    expect(partial.data.foods.map((f) => f.name)).toEqual(['Huevo']);
    expect(partial.warnings[0]).toMatch(/Pan/);
    // Respuesta vacía
    await expect(provider(async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 })).analyze(IMG)).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('14. Modelo no disponible (404)', async () => {
    const body = { error: { code: 404, message: 'models/gemini-x is not found for API version v1beta', status: 'NOT_FOUND' } };
    await expect(provider(async () => new Response(JSON.stringify(body), { status: 404 })).analyze(IMG)).rejects.toMatchObject({ code: 'model_unavailable' });
  });

  it('los secretos nunca aparecen en mensajes de error', () => {
    const e = new AIError('server', `fallo con clave ${KEY} y url https://x?key=${KEY}`);
    expect(e.message).not.toContain(KEY);
    expect(redactSecrets('api-key=abc&x=1')).toBe('api-key=[oculto]&x=1');
  });
});

describe('Cruce con la base de datos (la IA no aporta nutrientes)', () => {
  it('ignora un catalog_id inexistente y busca por nombre', () => {
    expect(matchVisionFood(food({ name: 'Plátano', catalog_id: 'no-existe', confidence: 0.9 })).food?.id).toBe('platano');
  });
  it('respeta la preparación indicada y distingue crudo de cocinado', () => {
    expect(matchVisionFood(food({ name: 'Arroz blanco', preparation: 'crudo', confidence: 0.9 })).food?.id).toBe('arroz-blanco-crudo');
    expect(matchVisionFood(food({ name: 'Arroz blanco', preparation: 'cocido', confidence: 0.9 })).food?.id).toBe('arroz-blanco-cocido');
  });
  it('si no hay coincidencia fiable no devuelve nada', () => {
    expect(matchVisionFood(food({ name: 'Zzxq desconocido', confidence: 0.9 })).food).toBeUndefined();
  });
});

describe('Límites, uso y seguridad de costes', () => {
  const settings = (patch: Partial<AppSettings> = {}): AppSettings => ({ ...DEFAULT_SETTINGS, aiProvider: 'gemini', geminiApiKey: KEY, geminiTermsAccepted: true, ...patch });
  const okPayload = { contains_food: true, image_quality: 'buena', meal_description: 'Manzana', foods: [food({ name: 'Manzana', confidence: 0.9, estimated_grams: 180 })], uncertainties: [] };

  beforeEach(async () => {
    await db.aiUsage.clear();
  });

  it('cuenta los análisis, avisa al 80 % y detiene al 100 % sin llamar al proveedor', async () => {
    const fetchMock = vi.fn(async () => geminiOk(okPayload));
    const prov = new GeminiProvider(KEY, 'gemini-4-hydrogen', fetchMock as unknown as typeof fetch);
    const s = settings({ aiDailyLimit: 5, aiWarnPercent: 80, aiBlockAtLimit: true });
    const levels: string[] = [];
    for (let i = 0; i < 5; i++) levels.push((await runAnalysis(s, IMG, {}, prov)).limit.level);
    expect(levels).toEqual(['ok', 'ok', 'ok', 'warn', 'limit']);
    await expect(runAnalysis(s, IMG, {}, prov)).rejects.toMatchObject({ code: 'personal_limit' });
    expect(fetchMock).toHaveBeenCalledTimes(5); // el sexto NO se envió
    const u = await getUsageSummary('gemini');
    expect(u.today).toBe(5);
    expect(u.errors[0].errorCode).toBe('personal_limit');
  });

  it('registra errores de cuota sin reintentar ni cambiar de proveedor', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' } }), { status: 429 }));
    const prov = new GeminiProvider(KEY, 'gemini-4-hydrogen', fetchMock as unknown as typeof fetch);
    await expect(runAnalysis(settings(), IMG, {}, prov)).rejects.toMatchObject({ code: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const u = await getUsageSummary('gemini');
    expect(u.errors[0].errorCode).toBe('quota');
  });

  it('exige aceptar las condiciones de Gemini antes de enviar fotos', async () => {
    const fetchMock = vi.fn(async () => geminiOk(okPayload));
    const prov = new GeminiProvider(KEY, 'gemini-4-hydrogen', fetchMock as unknown as typeof fetch);
    await expect(runAnalysis(settings({ geminiTermsAccepted: false }), IMG, {}, prov)).rejects.toMatchObject({ code: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin clave no se llama a la red', async () => {
    const fetchMock = vi.fn();
    const prov = new GeminiProvider('', 'gemini-4-hydrogen', fetchMock as unknown as typeof fetch);
    await expect(prov.analyze(IMG)).rejects.toMatchObject({ code: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
