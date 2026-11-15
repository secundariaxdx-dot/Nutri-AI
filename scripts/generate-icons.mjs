#!/usr/bin/env node
/** Genera favicon, iconos PWA, apple-touch-icon y pantallas de inicio de iOS. */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUB = join(ROOT, 'public');
mkdirSync(join(PUB, 'icons'), { recursive: true });
mkdirSync(join(PUB, 'splash'), { recursive: true });

const leaf = (s = 1, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy}) scale(${s})">
  <path d="M44 16c-15 0-25 9-25 22 0 3 .6 5.5 1.7 7.6C24 33 33 26 42 24c-8 4-15 11-18 23 2 1.2 4.6 1.9 7.6 1.9C44 49 50 37 50 22c0-2-.2-4-.6-6H44Z" fill="#b3e5c6"/>
  <circle cx="46" cy="44" r="3.2" fill="#fff" opacity=".9"/></g>`;
const grad = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1f7c4e"/><stop offset="1" stop-color="#13412e"/></linearGradient></defs>`;

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${grad}<rect width="64" height="64" rx="18" fill="url(#g)"/>${leaf()}</svg>`;
// Icono a sangre completa (iOS redondea las esquinas por su cuenta)
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${grad}<rect width="64" height="64" fill="url(#g)"/>${leaf(0.86, 3.5, 4.5)}</svg>`;
// Maskable: el contenido dentro de la zona segura (80 %)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${grad}<rect width="64" height="64" fill="url(#g)"/>${leaf(0.66, 10, 11)}</svg>`;

writeFileSync(join(PUB, 'favicon.svg'), favicon);
const png = (svg, size, file) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(PUB, file));
await png(favicon, 192, 'icons/icon-192.png');
await png(favicon, 512, 'icons/icon-512.png');
await png(maskable, 512, 'icons/icon-maskable-512.png');
await png(full, 180, 'icons/apple-touch-icon.png');
await png(favicon, 32, 'icons/favicon-32.png');

// Pantallas de inicio (portrait) para los iPhone más comunes: [ancho CSS, alto CSS, ratio]
const DEVICES = [
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [375, 667, 2], [402, 874, 3], [440, 956, 3],
];
const links = [];
for (const [w, h, r] of DEVICES) {
  const W = w * r, H = h * r, icon = Math.round(W * 0.28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${grad}
    <rect width="${W}" height="${H}" fill="#f6f8f5"/>
    <g transform="translate(${(W - icon) / 2} ${H / 2 - icon * 0.75})"><svg width="${icon}" height="${icon}" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="url(#g)"/>${leaf()}</svg></g>
    <text x="${W / 2}" y="${H / 2 + icon * 0.55}" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="${Math.round(W * 0.075)}" fill="#13412e" text-anchor="middle" letter-spacing="2">NUTRI <tspan fill="#1f7c4e">AI</tspan></text></svg>`;
  const file = `splash/iphone-${W}x${H}.png`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(join(PUB, file));
  links.push(`<link rel="apple-touch-startup-image" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)" href="${file}" />`);
}
writeFileSync(join(ROOT, 'scripts', 'splash-links.html'), links.join('\n') + '\n');
console.log('✔ Iconos y', links.length, 'pantallas de inicio generados');
