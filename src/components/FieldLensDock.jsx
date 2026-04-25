import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useStore from '../store/useStore';
import * as api from '../services/api';
import * as idb from '../services/indexeddb';
import { analyzeFieldPhoto } from '../services/lens';
import { recognizeImage, recognizeVideoFrame } from '../services/ocr';
import { extractTagCandidates, findElementByTag } from '../data/legendMap';

function buildPayload({ draft, suggestion, currentFluxogram, imageUrl }) {
  return {
    id: uuidv4(),
    fluxogram_id: currentFluxogram.id,
    x: draft.x,
    y: draft.y,
    tag: suggestion.suggestedTag,
    type: suggestion.type,
    description: `Sugestão IA via captura (${suggestion.confidence}% de confiança)`,
    image_url: imageUrl || '',
    tag_ok: Boolean(suggestion.matchedElementId || suggestion.suggestedTag),
    foto_ok: true,
    validado_campo: Boolean(suggestion.matchedElementId),
  };
}

function blobToFile(blob, name) {
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

async function canvasToFile(canvas, name) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return blob ? blobToFile(blob, name) : null;
}

async function fileToDataUrl(file) {
  if (!file) return '';
  if (String(file.type || '').startsWith('image/')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Falha ao converter imagem'));
      reader.readAsDataURL(file);
    });
  }
  return '';
}

export default function FieldLensDock() {
  const {
    lensDraft,
    clearLensDraft,
    addElement,
    updateElement,
    addNotification,
    currentFluxogram,
    elements,
    selectedElement,
    setLensFocus,
    clearLensFocus,
  } = useStore();

  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [suggestion, setSuggestion] = useState(null);
  const [tag, setTag] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('off');
  const [previewUrl, setPreviewUrl] = useState('');
  const [analysisSource, setAnalysisSource] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const objectUrlRef = useRef('');
  const latestCaptureRef = useRef(null);
  const ocrBusyRef = useRef(false);
  const liveScanTimerRef = useRef(null);
  const lastLiveSignatureRef = useRef('');

  const currentDraftFile = lensDraft?.file || latestCaptureRef.current;

  const derivedSuggestion = useMemo(() => {
    if (!currentDraftFile && !ocrText) return null;
    return analyzeFieldPhoto({
      file: currentDraftFile || undefined,
      ocrText,
      elements,
      selectedElement,
      currentFluxogram,
    });
  }, [currentDraftFile, ocrText, elements, selectedElement?.id, currentFluxogram?.id]);

  useEffect(() => {
    ocrBusyRef.current = ocrBusy;
  }, [ocrBusy]);

  useEffect(() => {
    if (!lensDraft?.file) return;
    setPreviewUrl(lensDraft.previewUrl || URL.createObjectURL(lensDraft.file));
    setAnalysisSource('arquivo');
  }, [lensDraft?.file]);

  useEffect(() => {
    if (!derivedSuggestion) return;
    if (!suggestion) {
      setSuggestion(derivedSuggestion);
      setTag(derivedSuggestion.suggestedTag || '');
    }
  }, [derivedSuggestion?.suggestedTag, derivedSuggestion?.matchedElementId, derivedSuggestion?.ocrText]);

  useEffect(() => {
    if (!lensDraft?.file) {
      if (!cameraOn) {
        setTag('');
        setSuggestion(null);
      }
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = lensDraft.previewUrl || URL.createObjectURL(lensDraft.file);
    setPreviewUrl(objectUrlRef.current);
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [lensDraft?.file]);

  useEffect(() => () => stopCamera(), []);

  const applyRecognitionResult = useCallback(
    async ({ text = '', confidence = 0, file = null, source = 'arquivo' }) => {
      const safeText = String(text || '').trim();
      const safeConfidence = Math.max(0, Math.min(100, Number(confidence || 0)));

      setAnalysisSource(source);
      setOcrText(safeText);
      setOcrConfidence(safeConfidence);

      const fallbackSuggestion = analyzeFieldPhoto({
        file: file || currentDraftFile || undefined,
        ocrText: safeText,
        elements,
        selectedElement,
        currentFluxogram,
      });

      let backendSuggestion = null;
      try {
        backendSuggestion = await api.analyzeVision({
          text: safeText,
          ocrText: safeText,
          confidence: safeConfidence,
          elements,
          selected_tag: selectedElement?.tag || '',
          source,
          file_name: file?.name || currentDraftFile?.name || '',
          fluxogram_name: currentFluxogram?.name || '',
        });
      } catch {
        backendSuggestion = null;
      }

      const merged = backendSuggestion
        ? {
            ...fallbackSuggestion,
            ...backendSuggestion,
            rationale: [
              ...(fallbackSuggestion.rationale || []),
              ...(backendSuggestion.rationale || []),
            ].filter(Boolean),
            candidates: backendSuggestion.candidates || fallbackSuggestion.candidates || [],
            matchedElementId: backendSuggestion.matchedElementId ?? fallbackSuggestion.matchedElementId ?? null,
            matchedElementTag: backendSuggestion.matchedElementTag ?? fallbackSuggestion.matchedElementTag ?? null,
            suggestedTag: backendSuggestion.suggestedTag || fallbackSuggestion.suggestedTag,
            confidence: Math.max(
              fallbackSuggestion.confidence || 0,
              backendSuggestion.confidence || 0,
              safeConfidence,
            ),
          }
        : fallbackSuggestion;

      const nextSuggestion = {
        ...merged,
        suggestedTag: extractTagCandidates(safeText)[0] || merged.suggestedTag,
      };

      setSuggestion(nextSuggestion);
      setTag(nextSuggestion.suggestedTag || '');

      if (nextSuggestion.matchedElementId || nextSuggestion.suggestedTag) {
        setLensFocus({
          tag: nextSuggestion.matchedElementTag || nextSuggestion.suggestedTag,
          elementId: nextSuggestion.matchedElementId,
          message: nextSuggestion.matchedElementId ? 'Elemento localizado' : 'Tag sugerida pela IA',
        });
      }

      return nextSuggestion;
    },
    [elements, selectedElement?.id, currentFluxogram?.id, currentDraftFile],
  );

  async function startCamera() {
    try {
      setCameraStatus('starting');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setCameraStatus('live');
      addNotification('Câmera aberta. O Lens vai escanear ao vivo.', 'info');
    } catch (err) {
      setCameraStatus('error');
      addNotification(`Não foi possível abrir a câmera: ${err.message}`, 'error');
    }
  }

  function stopCamera() {
    if (liveScanTimerRef.current) {
      clearInterval(liveScanTimerRef.current);
      liveScanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
    setCameraStatus('off');
    lastLiveSignatureRef.current = '';
  }

  useEffect(() => {
    if (!cameraOn) return undefined;

    liveScanTimerRef.current = setInterval(async () => {
      if (ocrBusyRef.current || !videoRef.current || videoRef.current.readyState < 2) return;

      try {
        ocrBusyRef.current = true;
        setOcrBusy(true);
        setCameraStatus('scanning');

        const result = await recognizeVideoFrame(videoRef.current);
        const text = String(result.text || '').trim();
        if (!text) return;

        const signature = `${text.slice(0, 120)}|${result.confidence || 0}`;
        if (signature === lastLiveSignatureRef.current) return;
        lastLiveSignatureRef.current = signature;

        const canvas = document.createElement('canvas');
        const video = videoRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));

        await applyRecognitionResult({
          text,
          confidence: result.confidence || 0,
          source: 'câmera ao vivo',
        });
      } catch (err) {
        if (String(err?.message || '').toLowerCase().includes('worker')) {
          addNotification('OCR indisponível no momento. Continue com a foto ou use captura manual.', 'warning');
        }
      } finally {
        ocrBusyRef.current = false;
        setOcrBusy(false);
        setCameraStatus('live');
      }
    }, 2800);

    return () => {
      if (liveScanTimerRef.current) {
        clearInterval(liveScanTimerRef.current);
        liveScanTimerRef.current = null;
      }
    };
  }, [cameraOn, applyRecognitionResult]);

  async function analyzeCurrentImage(file) {
    if (!file) return null;
    setOcrBusy(true);
    try {
      const { text, confidence } = await recognizeImage(file);
      return applyRecognitionResult({ text, confidence, file, source: 'arquivo' });
    } finally {
      setOcrBusy(false);
    }
  }

  async function captureAndAnalyze() {
    if (!videoRef.current || !streamRef.current) {
      addNotification('Abra a câmera primeiro.', 'warning');
      return;
    }

    setOcrBusy(true);
    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const file = await canvasToFile(canvas, `lens-${Date.now()}.jpg`);
      if (!file) throw new Error('Falha ao capturar imagem');

      latestCaptureRef.current = file;
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
      clearLensDraft();
      setAnalysisSource('câmera');

      const { text, confidence } = await recognizeImage(file);
      await applyRecognitionResult({ text, confidence, file, source: 'câmera' });
    } catch (err) {
      addNotification(`Falha ao capturar/analisar: ${err.message}`, 'error');
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleConfirm() {
    if (!currentFluxogram) {
      addNotification('Abra um fluxograma antes de criar elementos.', 'warning');
      return;
    }

    const finalTag = (tag.trim() || suggestion?.suggestedTag || '').trim();
    const finalSuggestion = suggestion || derivedSuggestion || {
      type: 'outro',
      suggestedTag: finalTag || 'X-001',
      confidence: 35,
      label: 'Elemento não classificado',
      matchedElementId: null,
      matchedElementTag: null,
    };

    setBusy(true);
    try {
      const file = currentDraftFile;
      let image_url = '';

      if (file) {
        try {
          image_url = await fileToDataUrl(file);
        } catch {
          image_url = previewUrl || '';
        }
      }

      const matchedElement = finalSuggestion.matchedElementId
        ? elements.find((el) => el.id === finalSuggestion.matchedElementId)
        : findElementByTag(elements, finalTag);

      if (matchedElement) {
        const updated = {
          ...matchedElement,
          tag: finalTag || matchedElement.tag,
          type: finalSuggestion.type || matchedElement.type,
          image_url: image_url || matchedElement.image_url || '',
          tag_ok: true,
          foto_ok: true,
          validado_campo: true,
          description: `Validado por câmera/Lens (${ocrConfidence}% OCR)`,
        };
        try {
          const saved = await api.updateElement(matchedElement.id, updated);
          updateElement(saved);
          await idb.saveElementLocal(saved);
          addNotification(`Elemento ${saved.tag} atualizado com foto e OCR.`, 'success');
        } catch {
          await idb.saveElementLocal(updated);
          await idb.enqueuePendingOp('update', 'elements', updated);
          updateElement(updated);
          addNotification(`Elemento ${updated.tag} salvo offline.`, 'warning');
        }
      } else {
        const payload = buildPayload({
          draft: lensDraft || { x: 0, y: 0 },
          suggestion: {
            ...finalSuggestion,
            suggestedTag: finalTag || finalSuggestion.suggestedTag,
          },
          currentFluxogram,
          imageUrl: image_url,
        });

        payload.tag = finalTag || payload.tag;
        payload.image_url = image_url;

        try {
          const created = await api.createElement(payload);
          addElement(created);
          await idb.saveElementLocal(created);
          addNotification('Foto analisada e elemento criado.', 'success');
        } catch {
          await idb.saveElementLocal(payload);
          await idb.enqueuePendingOp('create', 'elements', payload);
          addElement(payload);
          addNotification('Elemento salvo offline. Sincroniza quando voltar.', 'warning');
        }
      }

      clearLensDraft();
      clearLensFocus();
      setPreviewUrl('');
      setOcrText('');
      setSuggestion(null);
    } catch (err) {
      addNotification(`Falha ao processar: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    clearLensDraft();
    latestCaptureRef.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisSource('arquivo');
    await analyzeCurrentImage(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addNotification('Arraste uma imagem para o Lens.', 'warning');
      return;
    }
    clearLensDraft();
    latestCaptureRef.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    setAnalysisSource('arquivo');
    addNotification('Imagem carregada. OCR e sugestão em andamento.', 'info');
    analyzeCurrentImage(file);
  }

  if (!lensDraft && !previewUrl && !cameraOn) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[70] w-auto sm:w-[420px] pointer-events-none">
        <div className="pointer-events-auto rounded-3xl border shadow-2xl overflow-hidden bg-gray-900/95 backdrop-blur border-gray-700 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-orange-300 font-semibold">Field Lens</p>
              <h3 className="text-white font-semibold text-sm">Arraste foto ou abra a câmera</h3>
            </div>
            <button
              onClick={startCamera}
              className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2"
            >
              Abrir câmera
            </button>
          </div>
          <div
            className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-orange-400 bg-orange-500/10' : 'border-gray-700 bg-gray-950/40'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <p className="text-gray-200 text-sm">Solte a imagem do equipamento aqui</p>
            <p className="text-gray-500 text-xs mt-1">OCR lê tags como P-101, TIC-204, FV-12</p>
            <div className="mt-3 flex gap-2 justify-center">
              <button onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-3 py-2">Selecionar foto</button>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePick} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[70] w-auto sm:w-[420px] pointer-events-none">
      <div
        className={`pointer-events-auto rounded-3xl border shadow-2xl overflow-hidden bg-gray-900/95 backdrop-blur ${dragOver ? 'border-orange-400 ring-2 ring-orange-400/30' : 'border-gray-700'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-orange-300 font-semibold">Field Lens</p>
            <h3 className="text-white font-semibold text-sm">Câmera ao vivo + OCR</h3>
          </div>
          <div className="flex gap-2">
            {cameraOn ? (
              <button onClick={stopCamera} className="rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm px-3 py-2">Fechar</button>
            ) : (
              <button onClick={startCamera} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-3 py-2">Abrir câmera</button>
            )}
            <button onClick={clearLensDraft} className="w-8 h-8 rounded-full bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 transition">×</button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {cameraOn && (
            <div className="rounded-2xl overflow-hidden bg-black border border-gray-700 relative">
              <video ref={videoRef} playsInline muted className="w-full h-[220px] object-cover" />
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 text-[10px] uppercase tracking-[0.2em] text-cyan-200 border border-cyan-400/30">
                {cameraStatus === 'scanning' ? 'Escaneando' : 'Ao vivo'}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 flex items-center justify-between gap-2">
                <span className="text-xs text-gray-200">{cameraStatus === 'live' ? 'Pronto para capturar' : 'Iniciando câmera...'}</span>
                <button
                  onClick={captureAndAnalyze}
                  disabled={ocrBusy}
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2"
                >
                  {ocrBusy ? 'Analisando...' : 'Capturar e ler'}
                </button>
              </div>
            </div>
          )}

          {previewUrl && (
            <div className="grid grid-cols-[120px_1fr] gap-4">
              <div className="relative rounded-2xl overflow-hidden bg-gray-800 border border-gray-700 h-[140px] flex items-center justify-center">
                <img src={previewUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{suggestion?.icon || '⚪'}</span>
                  <div>
                    <p className="text-white text-sm font-semibold">{suggestion?.label || 'Elemento em análise'}</p>
                    <p className="text-gray-400 text-xs">
                      Confiança {suggestion?.confidence ?? 0}% · OCR {ocrConfidence}% · {analysisSource || 'arquivo'}
                    </p>
                  </div>
                </div>

                {ocrText ? (
                  <div className="rounded-xl bg-gray-800/80 border border-gray-700 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">OCR</p>
                    <p className="text-xs text-gray-200 leading-relaxed max-h-20 overflow-auto whitespace-pre-wrap">{ocrText.trim() || '—'}</p>
                  </div>
                ) : null}

                {suggestion?.rationale?.length ? (
                  <ul className="text-xs text-gray-400 space-y-1">
                    {suggestion.rationale.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-500">A legenda sugere um tipo, mas ainda não há evidência suficiente.</p>
                )}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-gray-500">Tag sugerida</span>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              className="mt-1 w-full bg-gray-800 text-white rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Ex: P-101, TIC-204"
            />
          </label>

          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 transition">Carregar foto</button>
            <button onClick={clearLensDraft} className="flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 transition">Cancelar</button>
            <button onClick={handleConfirm} disabled={busy} className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm py-2 font-semibold transition">
              {busy ? 'Salvando...' : 'Aplicar'}
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFilePick} />
        </div>
      </div>
    </div>
  );
}
