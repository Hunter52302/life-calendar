// Downscale + re-encode a user-chosen image before we store and (optionally)
// sync it. Background images are kept as data URLs inside the synced appearance
// record, so capping the pixel dimensions and re-encoding to WebP keeps that
// record to a few hundred KB instead of the multi-MB original a phone camera
// produces. Falls back to JPEG when the browser can't encode WebP.

const DEFAULTS = { maxEdge: 2560, type: 'image/webp', quality: 0.85 };

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = src;
  });
}

/**
 * Read `file`, shrink it so its longest edge is at most `maxEdge`, and return a
 * data URL. Images already within bounds are still re-encoded so the stored
 * format/size is predictable. On any failure we fall back to the raw data URL
 * so the user still gets their image.
 */
export async function downscaleImage(file, options = {}) {
  const { maxEdge, type, quality } = { ...DEFAULTS, ...options };
  const original = await readAsDataURL(file);
  try {
    const img = await loadImage(original);
    const { width, height } = img;
    if (!width || !height) return original;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const encoded = canvas.toDataURL(type, quality);
    // Some browsers return the default PNG when the requested type is
    // unsupported; only accept the result if it actually shrank the payload.
    if (encoded && encoded.length < original.length) return encoded;
    const jpeg = canvas.toDataURL('image/jpeg', quality);
    return jpeg && jpeg.length < original.length ? jpeg : original;
  } catch {
    return original;
  }
}
