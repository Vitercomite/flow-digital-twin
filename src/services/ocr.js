import { createWorker } from 'tesseract.js';

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_/.,: ',
      });
      return worker;
    })();
  }
  return workerPromise;
}

export async function recognizeImage(imageSource) {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageSource);
    return {
      text: result.data.text || '',
      confidence: Math.round(result.data.confidence || 0),
    };
  } catch {
    return { text: '', confidence: 0 };
  }
}

export async function recognizeVideoFrame(videoEl) {
  if (!videoEl) throw new Error('Video element not available');
  const canvas = document.createElement('canvas');
  const w = videoEl.videoWidth || 1280;
  const h = videoEl.videoHeight || 720;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, w, h);
  return recognizeImage(canvas);
}

export async function terminateOcrWorker() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } finally {
    workerPromise = null;
  }
}
