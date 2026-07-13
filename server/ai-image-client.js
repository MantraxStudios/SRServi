// Cliente HTTP hacia el servicio Python de generación de imágenes con IA
// (server/ai_image/, modelo open source SD-Turbo). Ver server/ai_image/main.py.

const AI_IMAGE_URL = process.env.AI_IMAGE_SERVICE_URL || 'http://127.0.0.1:8788';

export async function getAiImageStatus() {
  try {
    const res = await fetch(`${AI_IMAGE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { status: 'error', loaded: false, loading: false };
    return await res.json();
  } catch {
    return { status: 'unreachable', loaded: false, loading: false };
  }
}

// Genera una imagen a partir de un prompt de texto. Devuelve un Buffer PNG.
// La primera llamada puede tardar varios minutos si el modelo aún se está
// descargando/cargando en el servicio Python.
export async function generateAiImage({ prompt, negativePrompt, width = 512, height = 512, steps = 2 }) {
  const res = await fetch(`${AI_IMAGE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      negative_prompt: negativePrompt,
      width,
      height,
      steps,
    }),
    signal: AbortSignal.timeout(300000),
  });
  const data = await res.json().catch(() => ({ detail: 'Respuesta inválida del servicio de imágenes IA' }));
  if (!res.ok) throw new Error(data.detail || `Error ${res.status} del servicio de imágenes IA`);
  return Buffer.from(data.image_base64, 'base64');
}
