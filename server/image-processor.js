import sharp from 'sharp';
import path from 'path';
import { rename, unlink } from 'fs/promises';

const MAX_DIM = 900;
const JPEG_QUALITY = 85;

// Corrige orientación EXIF, recorta a cuadrado con detección automática de la
// zona más relevante de la foto y recomprime a JPEG. Muta file.filename/file.path
// para que apunten al archivo procesado (siempre .jpg).
export async function processProductImage(file) {
  if (!file) return;

  const dir = path.dirname(file.path);
  const base = path.basename(file.path, path.extname(file.path));
  // Normalizados con path.join/resolve para poder compararlos de forma
  // confiable — file.path puede traer '/' (multer) mientras que path.join
  // genera '\' en Windows, y son el mismo archivo aunque el string difiera.
  const originalPath = path.join(dir, path.basename(file.path));
  const tmpPath = path.join(dir, `${base}.tmp.jpg`);
  const finalPath = path.join(dir, `${base}.jpg`);

  try {
    await sharp(originalPath)
      .rotate()
      .resize(MAX_DIM, MAX_DIM, { fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(tmpPath);

    await rename(tmpPath, finalPath);
    if (path.resolve(originalPath) !== path.resolve(finalPath)) {
      await unlink(originalPath).catch(() => {});
    }

    file.filename = `${base}.jpg`;
    file.path = finalPath;
  } catch (error) {
    // Si sharp falla (formato raro, archivo corrupto), seguimos con el
    // archivo original tal cual subió el usuario en vez de romper el flujo.
    await unlink(tmpPath).catch(() => {});
    console.warn('[image-processor] No se pudo procesar la imagen, se usa el original:', error.message);
  }
}
