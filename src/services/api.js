/** Base URL – empty string means relative (works via Vite proxy in dev) */
const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  if (!BASE) {
    // 🚀 SEM BACKEND → retorna vazio
    console.warn('API desativada, usando modo offline:', path);

    if (path.includes('fluxograms')) return [];
    if (path.includes('elements')) return [];

    return {};
  }

  const url = `${BASE}/api${path}`;

  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const checkHealth = () => request('/health');
export const getFluxograms = () => request('/fluxograms');
export const getFluxogram = (id) => request(`/fluxograms/${id}`);
export const createFluxogram = (data) => request('/fluxograms', { method: 'POST', body: JSON.stringify(data) });
export const updateFluxogram = (id, data) => request(`/fluxograms/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFluxogram = (id) => request(`/fluxograms/${id}`, { method: 'DELETE' });

export const getElementsByFluxogram = (fluxogramId) => request(`/elements/fluxogram/${fluxogramId}`);
export const createElement = (data) => request('/elements', { method: 'POST', body: JSON.stringify(data) });
export const updateElement = (id, data) => request(`/elements/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const patchElement = (id, data) => request(`/elements/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteElement = (id) => request(`/elements/${id}`, { method: 'DELETE' });

export async function uploadFile(file) {
  // 🚀 SEM BACKEND → cria URL local
  return {
    url: URL.createObjectURL(file)
  };
}

export async function analyzeVision(payload) {
  console.warn('Vision API desativada (modo local)');
  return { detections: [] };
}

export function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  return `${BASE}${url}`;
}
