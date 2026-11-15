#!/usr/bin/env node
/**
 * Genera src/data/foods.generated.json a partir del conjunto de datos público
 * USDA FoodData Central — SR Legacy (dominio público, CC0).
 *
 * Uso:
 *   node scripts/build-food-db.mjs [ruta-a-carpeta-csv]
 *
 * Si no se indica la ruta, descarga el ZIP oficial en ./.cache/usda.
 * El JSON generado se versiona en el repositorio, así que este script solo
 * es necesario si se modifica scripts/food-catalog.mjs.
 */
import { createReadStream, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';
import { CATALOG, DISHES } from './food-catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIP_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip';

/** Nutrient IDs de FDC → claves internas de Nutri AI */
const NUTRIENT_MAP = {
  1008: 'kcal',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1258: 'saturatedFat',
  1079: 'fiber',
  2000: 'sugars',
  1093: 'sodium',
  1092: 'potassium',
  1087: 'calcium',
  1089: 'iron',
  1090: 'magnesium',
  1091: 'phosphorus',
  1095: 'zinc',
  1106: 'vitaminA',
  1162: 'vitaminC',
  1114: 'vitaminD',
  1109: 'vitaminE',
  1165: 'thiamin',
  1166: 'riboflavin',
  1167: 'niacin',
  1175: 'vitaminB6',
  1190: 'folate',
  1178: 'vitaminB12',
};
const FOLATE_TOTAL = 1177; // se usa si falta folato DFE

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function readCsv(file, onRow) {
  const rl = readline.createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const cols = parseCsvLine(line);
    if (!header) { header = cols; continue; }
    onRow(Object.fromEntries(header.map((h, i) => [h, cols[i]])));
  }
}

function resolveDir(arg) {
  if (arg) return arg;
  const cache = join(ROOT, '.cache', 'usda');
  const find = () => existsSync(cache) && readdirSync(cache).find((d) => d.startsWith('FoodData_Central_sr_legacy'));
  if (!find()) {
    mkdirSync(cache, { recursive: true });
    console.log('Descargando SR Legacy desde USDA…');
    execSync(`curl -sSL -o "${join(cache, 'sr.zip')}" "${ZIP_URL}" && unzip -o -q "${join(cache, 'sr.zip')}" -d "${cache}"`, { stdio: 'inherit' });
  }
  return join(cache, find());
}

const round = (v) => {
  if (v === 0) return 0;
  const abs = Math.abs(v);
  const d = abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3;
  return Number(v.toFixed(d));
};

async function main() {
  const dir = resolveDir(process.argv[2]);
  const wanted = new Map(CATALOG.map((c) => [String(c.fdc), c]));
  const ids = new Set();
  for (const c of CATALOG) {
    if (ids.has(c.id)) throw new Error(`ID duplicado: ${c.id}`);
    ids.add(c.id);
  }

  const descriptions = new Map();
  await readCsv(join(dir, 'food.csv'), (r) => {
    if (wanted.has(r.fdc_id)) descriptions.set(r.fdc_id, r.description);
  });
  const missing = CATALOG.filter((c) => !descriptions.has(String(c.fdc)));
  if (missing.length) {
    throw new Error('FDC IDs no encontrados: ' + missing.map((m) => `${m.id}=${m.fdc}`).join(', '));
  }

  const nutrients = new Map();
  await readCsv(join(dir, 'food_nutrient.csv'), (r) => {
    if (!wanted.has(r.fdc_id)) return;
    const nid = Number(r.nutrient_id);
    const amount = Number(r.amount);
    if (!Number.isFinite(amount)) return;
    const m = nutrients.get(r.fdc_id) ?? {};
    if (NUTRIENT_MAP[nid]) m[NUTRIENT_MAP[nid]] = round(amount);
    else if (nid === FOLATE_TOTAL) m._folateTotal = round(amount);
    nutrients.set(r.fdc_id, m);
  });

  const foods = CATALOG.map((c) => {
    const n = { ...(nutrients.get(String(c.fdc)) ?? {}) };
    if (n.folate === undefined && n._folateTotal !== undefined) n.folate = n._folateTotal;
    delete n._folateTotal;
    if (n.kcal === undefined) throw new Error(`Sin energía para ${c.id}`);
    return {
      id: c.id,
      name: c.name,
      aliases: c.aliases ?? [],
      category: c.cat,
      preparation: c.prep,
      portion: c.portion,
      ...(c.vision ? { vision: c.vision } : {}),
      source: { kind: 'usda-sr', fdcId: c.fdc, description: descriptions.get(String(c.fdc)) },
      nutrients: n,
    };
  });

  const foodIds = new Set(foods.map((f) => f.id));
  for (const d of DISHES) {
    for (const [fid, g] of d.items) {
      if (!foodIds.has(fid)) throw new Error(`Plato ${d.id}: ingrediente desconocido ${fid}`);
      if (!(g > 0)) throw new Error(`Plato ${d.id}: gramos inválidos`);
    }
  }
  const dishes = DISHES.map((d) => ({ id: d.id, name: d.name, vision: d.vision, items: d.items.map(([foodId, grams]) => ({ foodId, grams })) }));

  const out = join(ROOT, 'src', 'data', 'foods.generated.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ dataset: 'USDA FoodData Central — SR Legacy (2018-04)', generatedAt: new Date().toISOString().slice(0, 10), foods, dishes }, null, 0) + '\n');
  console.log(`✔ ${foods.length} alimentos escritos en ${out}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
