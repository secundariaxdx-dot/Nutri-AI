# 🥗 NUTRI AI

**Diario nutricional inteligente, gratuito y privado.** Fotografía tu comida, la inteligencia artificial identifica los alimentos **en tu propio dispositivo**, propone cantidades orientativas y calcula calorías, macronutrientes y micronutrientes con datos de fuentes públicas identificables.

- 📸 Análisis de fotos con IA local (sin enviar imágenes a ningún servidor)
- 🔎 Buscador de alimentos: base local + Open Food Facts + USDA FoodData Central
- 🏷️ Escáner de códigos de barras (EAN/UPC) con Open Food Facts
- 📓 Diario por días con calendario, edición, duplicado y eliminación
- 📊 Estadísticas de 7, 30 y 90 días (calorías, macros, micronutrientes, peso)
- 🎯 Perfil y objetivos (Mifflin-St Jeor, orientativo) o personalizados
- 📱 PWA instalable en iPhone/Android/escritorio, funciona sin conexión
- 💾 Local-first (IndexedDB), exportación/importación JSON
- ☁️ Sincronización multidispositivo **opcional** con tu propio Supabase gratuito
- 💸 Sin suscripciones, sin pagos, sin anuncios, sin APIs de pago

---

## Índice

1. [Tecnologías](#tecnologías)
2. [Instalación y ejecución](#instalación-y-ejecución)
3. [Cómo funciona el análisis de imágenes](#cómo-funciona-el-análisis-de-imágenes)
4. [Datos nutricionales](#datos-nutricionales)
5. [Servicios gratuitos utilizados](#servicios-gratuitos-utilizados)
6. [Despliegue en GitHub Pages](#despliegue-en-github-pages)
7. [Alternativa: Cloudflare Pages](#alternativa-cloudflare-pages)
8. [Instalar en iPhone](#instalar-en-iphone)
9. [Sincronización opcional con Supabase](#sincronización-opcional-con-supabase)
10. [Privacidad](#privacidad)
11. [Limitaciones de la inteligencia artificial](#limitaciones-de-la-inteligencia-artificial)
12. [Estructura del proyecto](#estructura-del-proyecto)
13. [Pruebas](#pruebas)

---

## Tecnologías

| Área | Tecnología |
|---|---|
| Interfaz | React 18, TypeScript, Vite 6, Tailwind CSS, Lucide Icons |
| Gráficos | Recharts |
| Almacenamiento | IndexedDB con Dexie.js (+ `dexie-react-hooks` para actualizaciones en vivo) |
| PWA | vite-plugin-pwa (Workbox): manifest, service worker, caché offline |
| IA | Transformers.js (`@huggingface/transformers`) + ONNX Runtime WebAssembly, modelo **MobileCLIP-S0** (Apple) |
| Códigos de barras | ZXing (`@zxing/browser`), compatible con Safari iOS |
| Datos | USDA FoodData Central (SR Legacy), Open Food Facts |
| Sincronización | Supabase (opcional, plan gratuito), cargado bajo demanda |
| Pruebas | Vitest + fake-indexeddb |

## Instalación y ejecución

Requisitos: **Node.js 20 o superior**.

```bash
npm install
```

```bash
npm run dev
```

Abre la URL que muestra la consola (normalmente `http://localhost:5173`).

Otros comandos:

```bash
npm test             # pruebas automatizadas
npm run build        # compilación de producción en dist/
npm run preview      # sirve la compilación localmente
npm run typecheck    # comprobación de tipos
```

> La cámara y la instalación como PWA requieren **HTTPS** (o `localhost`). Para probar en el móvil dentro de tu red local usa el despliegue en GitHub Pages o `npm run dev -- --host` con un túnel HTTPS.

### Variables de entorno (todas opcionales)

Copia `.env.example` a `.env.local` si quieres preconfigurar algo:

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Preconfiguran la sincronización (también se puede hacer desde Ajustes). |
| `VITE_USDA_API_KEY` | Clave gratuita de api.data.gov para USDA (también desde Ajustes). |
| `VITE_BASE` | Ruta base del despliegue (el workflow de GitHub la define solo). |

**No hay claves secretas en el código.** La clave “anon/publishable” de Supabase es pública por diseño; la app rechaza explícitamente las claves `service_role`/`secret`.

## Cómo funciona el análisis de imágenes

1. **Captura**: en iPhone, «Hacer foto» abre la cámara nativa (`<input capture>`); «Elegir de la galería» abre las fotos. La imagen se reduce a 1280 px y se genera una miniatura.
2. **Modelo local**: se descarga una única vez el codificador de imagen de **MobileCLIP-S0** (≈23 MB, en `fp16`) desde Hugging Face y queda en la caché del navegador. A partir de ahí **funciona sin conexión**. Se ejecuta en un *Web Worker* con WebAssembly para no bloquear la interfaz.
3. **Reconocimiento *zero-shot***: el modelo compara la imagen con ~200 descripciones de alimentos y platos (p. ej. *“grilled chicken breast”*, *“white rice”*, *“paella”*). Los *embeddings* de texto de esas etiquetas se **precalculan** (`public/ai/*.labels.json`, 157 KB), así que el navegador no necesita descargar el modelo de texto.
4. **Varios alimentos por plato**: se analizan la imagen completa y 5 regiones (4 cuadrantes solapados y el centro). Un alimento visto solo en una región necesita respaldo (aparecer en ≥2 regiones, algo de probabilidad global o confianza muy alta), lo que reduce falsos positivos. Un plato con pollo, arroz y brócoli genera tres elementos.
5. **Platos compuestos**: si se reconoce un plato (paella, ensalada César, lasaña, sushi, tortilla de patatas…), se **desglosa en ingredientes** con cantidades típicas, que el usuario puede ajustar. Si hay hipótesis rivales (p. ej. pizza vs. lasaña) se muestra la más probable y las otras como alternativas de un toque.
6. **Cantidades**: se proponen raciones típicas ajustadas por el área relativa que ocupa cada alimento. Se marcan como **«Estimado»**, y antes de guardar se pide confirmación.
7. **Revisión**: pantalla de resultados con foto, alimentos, gramos, calorías, macros, micronutrientes y total. Botones **GUARDAR EN MI DIARIO**, **VOLVER A ANALIZAR** y **EDITAR ALIMENTOS** (cambiar gramos, añadir o quitar alimentos; todo se recalcula al instante).

Si el dispositivo no es compatible, no hay conexión para la primera descarga, el modelo falla o el usuario desactiva la IA, **la app lo indica claramente** y ofrece registrar la foto añadiendo los alimentos manualmente. Nunca se simula un resultado.

### Rendimiento medido

Pruebas reales en Chromium (escritorio) con imágenes del conjunto Food-101: primera vez ≈8 s (incluye la descarga del modelo); después ≈3–5 s por foto. En la evaluación previa sobre 78 imágenes de Food-101 con equivalente en el catálogo, MobileCLIP-S0 acertó el alimento principal en el **67 %** de los casos como primera opción y en el **90 %** entre las tres primeras (CLIP ViT-B/32: 62 % / 82 %).

### Cambiar de modelo

El contrato `FoodRecognizer` (`src/ai/types.ts`) aísla el resto de la app del modelo concreto:

- Los modelos disponibles están en `src/config/ai.ts` (`VISION_MODELS`). Se incluye también **CLIP ViT-B/16** como alternativa seleccionable en Ajustes.
- Para añadir un modelo compatible con CLIP en Transformers.js: añade una entrada y ejecuta `npm run build:vision` para generar sus etiquetas.
- Para un sistema distinto (detector de objetos, servidor propio…), implementa `FoodRecognizer` y devuélvelo en `getRecognizer()` (`src/ai/index.ts`).

## Datos nutricionales

Todos los valores se guardan **por 100 g** y se escalan linealmente (150 g = 150 % de los valores por 100 g).

1. **Base local incluida** (`src/data/foods.generated.json`): **230 alimentos** habituales + **24 platos** desglosados, con nombres en español y valores reales extraídos del conjunto **USDA FoodData Central – SR Legacy** (dominio público). Cada alimento enlaza su **FDC ID** y la descripción exacta de USDA (visibles en la app con enlace a la ficha). Incluye 24 nutrientes: energía, proteínas, carbohidratos, grasas, saturadas, fibra, azúcares, sodio, potasio, calcio, hierro, magnesio, fósforo, zinc y vitaminas A, C, D, E, B1, B2, B3, B6, B9 y B12.
2. **Open Food Facts**: productos envasados por código de barras o nombre, con ingredientes y alérgenos.
3. **USDA FoodData Central (API)**: búsqueda ampliada (en inglés).
4. **Mis alimentos**: alimentos creados por el usuario desde la etiqueta (por 100 g o por ración). Los productos consultados en línea se guardan aquí para usarlos sin conexión.

**Crudo ≠ cocinado**: cada preparación (crudo, cocido, a la plancha, frito, horneado, asado…) es un registro distinto con sus propios valores USDA. **Sin datos ≠ 0**: si una fuente no aporta un nutriente se muestra «Sin datos» y los totales afectados se marcan como parciales (*).

Para regenerar la base local (por ejemplo, tras editar `scripts/food-catalog.mjs`):

```bash
npm run build:foods
```

## Servicios gratuitos utilizados

| Servicio | Para qué | Coste | Registro |
|---|---|---|---|
| Hugging Face Hub | Descarga única del modelo de IA | Gratis | No |
| jsDelivr / propia web | Runtime ONNX WebAssembly | Gratis | No |
| Open Food Facts | Productos y códigos de barras | Gratis (datos abiertos ODbL) | No |
| USDA FoodData Central | Búsqueda ampliada | Gratis | Opcional: [clave gratuita sin tarjeta](https://fdc.nal.usda.gov/api-key-signup) (sin ella se usa `DEMO_KEY`, muy limitada) |
| GitHub Pages | Alojamiento | Gratis | Cuenta de GitHub |
| Supabase | Sincronización opcional | Plan gratuito (sin tarjeta) | Solo si la usas |

## Despliegue en GitHub Pages

El repositorio incluye `.github/workflows/deploy.yml`, que **prueba, compila y publica automáticamente** en cada *push* a la rama `main`.

1. Sube el código a la rama `main` de tu repositorio en GitHub.
2. En GitHub: **Settings › Pages › Build and deployment › Source: _GitHub Actions_**.
3. Haz *push* a `main` (o ejecuta el workflow manualmente en **Actions › Desplegar en GitHub Pages › Run workflow**).
4. La app quedará en:

```
https://<tu-usuario>.github.io/<nombre-del-repositorio>/
```

Para este repositorio: **https://secundariaxdx-dot.github.io/Nutri-AI/**

Detalles técnicos: la ruta base se toma del nombre del repositorio (`VITE_BASE`), y se usa enrutado con *hash* (`#/diario`) para que recargar cualquier pantalla funcione sin configuración de servidor.

## Alternativa: Cloudflare Pages

Si prefieres otro alojamiento gratuito:

1. En Cloudflare: **Workers & Pages › Create › Pages › Connect to Git** y elige el repositorio.
2. *Build command*: `npm run build` · *Output directory*: `dist`.
3. Variable de entorno: `VITE_BASE=/` (y `NODE_VERSION=22`).
4. Despliega. Obtendrás `https://<proyecto>.pages.dev`.

Netlify o Vercel funcionan igual (comando `npm run build`, carpeta `dist`).

## Instalar en iPhone

1. Abre la página en **Safari**.
2. Pulsa **Compartir** (el cuadrado con la flecha).
3. Selecciona **Añadir a pantalla de inicio**.
4. Abre **Nutri AI** desde el icono: se ejecutará a pantalla completa, con su icono y pantalla de inicio.

> En iOS, Safari y la app instalada tienen almacenamientos separados. Si empezaste a usarla en Safari, exporta una copia en **Ajustes** e impórtala en la app instalada.

En **Android, Chrome y Edge** aparece la opción «Instalar aplicación» (o el botón de la propia app).

## Sincronización opcional con Supabase

La app funciona completamente sin esto. Si quieres ver los mismos datos en varios dispositivos:

1. Crea una cuenta gratuita en [supabase.com](https://supabase.com) y un proyecto nuevo (plan *Free*, sin tarjeta).
2. Ve a **SQL Editor › New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Crea las tablas `meals`, `profiles` y `custom_foods`, las reglas de seguridad por usuario (RLS) y el *bucket* privado `meal-photos`.
3. En **Project Settings › API** copia la **Project URL** y la clave **anon / publishable** (¡nunca la `service_role`/`secret`!).
4. (Recomendado) En **Authentication › URL Configuration** pon como *Site URL* la dirección de tu app (p. ej. `https://secundariaxdx-dot.github.io/Nutri-AI/`), que es adonde redirige el correo de confirmación.
5. En Nutri AI: **Ajustes › Sincronización**, pega URL y clave, crea una cuenta con correo y contraseña, confirma el correo e inicia sesión.
6. Repite el paso 5 (iniciar sesión) en cada dispositivo.

Alternativamente, define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como *Repository variables* en GitHub para que la app ya venga configurada.

**Qué se sincroniza**: comidas (alimentos, cantidades, nutrientes, fecha, notas), perfil y objetivos, alimentos personalizados y, si activas «Sincronizar fotos», las fotos (en almacenamiento privado de tu proyecto).

**Cómo funciona**: arquitectura *local-first*. Cada cambio se guarda primero en el dispositivo y se marca como pendiente; la app sincroniza al abrirse, al recuperar la conexión, tras los cambios y cada 5 minutos. Los identificadores son UUID (no hay duplicados), los borrados se propagan como «lápidas», y los conflictos se resuelven con **la última modificación gana**. Sin conexión todo sigue funcionando y se sincroniza después.

## Privacidad

- Las fotos se analizan **en el dispositivo**; nunca se envían a terceros.
- Solo se contacta con Open Food Facts/USDA para buscar un código o texto, sin datos personales.
- Sin publicidad, analíticas ni rastreo. Sin venta de datos.
- Todos los datos del perfil son opcionales.
- **Ajustes › Borrar todos los datos** elimina todo del dispositivo (incluido el modelo descargado).

## Limitaciones de la inteligencia artificial

Es importante entenderlas:

- **Las cantidades son estimaciones.** Una foto normal no permite medir peso ni volumen. La app propone raciones típicas ajustadas por el área aparente; revísalas siempre (mejor con una báscula).
- **Reconocimiento *zero-shot* con un vocabulario cerrado** de ~200 alimentos y platos. Lo que no esté en el catálogo se aproximará al más parecido o no se detectará: añádelo manualmente.
- **Confusiones visuales**: alimentos parecidos (salmón vs. bacalao, pechuga vs. lomo, arroz vs. cuscús) pueden confundirse. Las salsas, aceites, el azúcar y los ingredientes ocultos (rellenos, aliños) **no se ven** en la foto.
- **La preparación** (frito vs. plancha) no siempre se distingue y cambia mucho las calorías: revisa la preparación elegida.
- **Platos mezclados** (guisos, cremas, bocadillos cerrados) se reconocen peor que alimentos separados.
- **Rendimiento**: la primera vez hay que descargar ≈23 MB; en móviles antiguos el análisis puede tardar más. En dispositivos sin WebAssembly la IA no está disponible y se usa el registro manual.
- La precisión medida (67 % primera opción / 90 % top-3 en Food-101) es orientativa y depende mucho de la foto.

Nutri AI ofrece **estimaciones orientativas** y no sustituye el consejo de profesionales sanitarios. No realiza recomendaciones médicas ni dietas extremas: los objetivos automáticos aplican ajustes moderados y nunca bajan del metabolismo basal estimado.

## Estructura del proyecto

```
src/
├── ai/              Reconocimiento de imágenes (contrato, worker, detección, análisis)
├── components/      Componentes de interfaz (layout, ui, meal, charts, barcode, settings)
├── config/          Configuración (app, nutrientes y VRN, modelos de IA)
├── data/            Base de datos local generada desde USDA
├── db/              IndexedDB (Dexie): comidas, perfil, ajustes, copias de seguridad
├── hooks/           Hooks reactivos (datos, IA, sincronización, instalación…)
├── lib/             Cálculos nutricionales, energía, fechas, imágenes, estadísticas
├── pages/           Pantallas
├── services/        Open Food Facts, USDA, búsqueda unificada, sincronización
├── store/           Borrador de comida compartido entre pantallas
└── types/           Modelos de datos
scripts/             Generación de la base de alimentos, embeddings e iconos
supabase/schema.sql  Esquema opcional para sincronización
public/ai/           Embeddings precalculados de las etiquetas
```

## Pruebas

```bash
npm test
```

55 pruebas automatizadas cubren: escalado y suma de nutrientes (incluido «sin datos» y totales parciales), base de datos local (crudo vs. cocinado, fuentes, búsqueda), fórmulas de energía y objetivos, estadísticas y fechas, operaciones de comidas en IndexedDB (guardar, editar, validar, eliminar/deshacer, duplicar, separación por días), perfil, alimentos personalizados, copias de seguridad, motor de sincronización (subida, descarga, sin duplicados, conflictos, borrados, fotos, perfil) con un servidor simulado, lógica de detección de la IA, y conversión de datos de Open Food Facts y USDA.

---

Datos: USDA FoodData Central (dominio público) · Open Food Facts (ODbL) · Modelos: MobileCLIP (Apple), CLIP (OpenAI) vía Transformers.js.
