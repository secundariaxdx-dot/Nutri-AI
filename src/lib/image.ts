/** Procesado de fotografías en el navegador (redimensionado y compresión). */

export interface ProcessedPhoto {
  photo: Blob;
  thumb: Blob;
}

async function loadBitmapSource(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error('No se pudo leer la imagen. Prueba con otra foto (JPG, PNG o HEIC compatible).');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function resizeToBlob(img: HTMLImageElement, maxSide: number, quality: number, square = false): Promise<Blob> {
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (square) {
    const side = Math.min(sw, sh);
    sx = (sw - side) / 2;
    sy = (sh - side) / 2;
    sw = sh = side;
  }
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas no disponible');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', quality),
  );
}

/** Reduce la foto a ≤1280 px (≈150–300 KB) y genera una miniatura cuadrada. */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const img = await loadBitmapSource(file);
  const [photo, thumb] = await Promise.all([resizeToBlob(img, 1280, 0.82), resizeToBlob(img, 320, 0.75, true)]);
  return { photo, thumb };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Contenido de un Blob en base64 (sin el prefijo data:). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}
