/**
 * Image-compressie utility: verkleint foto's client-side vóór upload.
 *
 * Doel: maxBytes per foto (default 1.2 MB) bereiken zodat upload betrouwbaar werkt
 * over mobiele netwerken en proxy-time-outs niet meer optreden.
 *
 * Aanpak:
 *   1. Lees de file als bitmap (createImageBitmap voor snelheid op mobiel)
 *   2. Schaal proportioneel zodat langste zijde ≤ maxDimension (default 2000 px)
 *   3. Render naar canvas → JPEG met opgegeven kwaliteit
 *   4. Probeer iteratief lagere kwaliteit als bestand nog te groot is
 *
 * Non-image files (bv. PDF) worden ongewijzigd teruggegeven.
 */

const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_MAX_BYTES = 1_200_000; // 1.2 MB
const DEFAULT_QUALITY = 0.82;
const MIN_QUALITY = 0.55;

async function fileToBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {/* fall back to img */}
  }
  // Fallback voor oude Safari
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/**
 * Comprimeer 1 file. Returnt: een nieuwe File of de originele als compressie niet helpt.
 */
export async function compressImage(file, opts = {}) {
  const maxDim = opts.maxDimension || DEFAULT_MAX_DIMENSION;
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  let quality = opts.quality || DEFAULT_QUALITY;

  if (!file || !(file.type || '').startsWith('image/')) return file;
  // Heel klein? Skip.
  if (file.size <= maxBytes) return file;

  let bitmap;
  try { bitmap = await fileToBitmap(file); } catch { return file; }

  const w0 = bitmap.width;
  const h0 = bitmap.height;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);

  // Iteratief kwaliteit verlagen tot we onder maxBytes komen
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  while (blob && blob.size > maxBytes && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1);
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  }
  if (bitmap.close) try { bitmap.close(); } catch {/* noop */}
  if (!blob) return file;
  if (blob.size >= file.size) return file; // compressie hielp niet → origineel

  // Bouw een nieuwe File met dezelfde naam (maar .jpg)
  const baseName = (file.name || 'photo').replace(/\.(jpe?g|png|webp|heic|heif)$/i, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * Comprimeer een lijst files met progress callback.
 * onProgress(i, total) wordt aangeroepen vóór elke compressie.
 */
export async function compressImages(files, onProgress, opts = {}) {
  const total = files.length;
  const out = new Array(total);
  for (let i = 0; i < total; i++) {
    if (onProgress) onProgress(i, total);
    try {
      out[i] = await compressImage(files[i], opts);
    } catch {
      out[i] = files[i];
    }
  }
  if (onProgress) onProgress(total, total);
  return out;
}
