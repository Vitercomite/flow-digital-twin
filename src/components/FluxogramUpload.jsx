import React, { useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useStore from '../store/useStore';
import * as api from '../services/api';
import * as idb from '../services/indexeddb';
import { renderPDFToImage } from '../services/pdfRenderer';

const PROCESS_TIMEOUT_MS = 15000;

function withTimeout(promise, ms, label = 'processamento') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} excedeu ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

async function fileToImageSource(file) {
  if (!file) return '';
  if (file.type === 'application/pdf') {
    return renderPDFToImage(file);
  }
  return fileToDataUrl(file);
}

export default function FluxogramUpload() {
  const {
    fluxograms,
    addFluxogram,
    updateFluxogram,
    setCurrentFluxogram,
    isOnline,
    addNotification,
  } = useStore();

  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [processingId, setProcessingId] = useState('');

  const fileRef = useRef(null);

  async function persistImageInBackground(fluxogramId, file) {
    const base = fluxograms.find((item) => item.id === fluxogramId) || { id: fluxogramId, name: name.trim(), image_url: '' };

    try {
      const image_url = await withTimeout(fileToImageSource(file), PROCESS_TIMEOUT_MS, 'renderização do arquivo');
      if (!image_url) return;

      let updated = { ...base, image_url, updated_at: Math.floor(Date.now() / 1000) };
      try {
        updated = await api.updateFluxogram(fluxogramId, { image_url });
      } catch {
        await idb.enqueuePendingOp('update', 'fluxograms', { id: fluxogramId, image_url });
      }

      updateFluxogram(updated);
      await idb.saveFluxogramLocal(updated);
      addNotification('Imagem/PDF aplicado ao fluxograma com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      addNotification('O fluxograma foi criado, mas a imagem demorou demais para processar. Você pode tentar novamente.', 'warning');
    } finally {
      setProcessingId((current) => (current === fluxogramId ? '' : current));
    }
  }

  async function createFluxogram(file) {
    if (!name.trim()) {
      addNotification('Informe um nome para o fluxograma', 'error');
      return;
    }

    setUploading(true);
    try {
      const id = uuidv4();
      const basePayload = {
        id,
        name: name.trim(),
        image_url: '',
      };

      let created;
      try {
        created = await api.createFluxogram(basePayload);
      } catch {
        created = {
          ...basePayload,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        };
        await idb.enqueuePendingOp('create', 'fluxograms', created);
        addNotification('Fluxograma criado offline. Será sincronizado quando houver conexão.', 'warning');
      }

      addFluxogram(created);
      await idb.saveFluxogramLocal(created);
      setCurrentFluxogram(created);

      if (file) {
        setProcessingId(created.id);
        addNotification('Arquivo recebido. Processando PDF/imagem em segundo plano.', 'info');
        void persistImageInBackground(created.id, file);
      }
    } finally {
      setUploading(false);
      setName('');
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) createFluxogram(file);
    e.target.value = '';
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) createFluxogram(file);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') fileRef.current?.click();
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center py-8">
          <div className="text-5xl mb-3">⚙️</div>
          <h1 className="text-2xl font-bold text-white">Industrial Flow Digital Twin</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Faça upload do seu fluxograma e comece a mapear os equipamentos.
          </p>
          {!isOnline && (
            <div className="mt-3 inline-flex items-center gap-2 bg-yellow-900/50 border border-yellow-700 text-yellow-300 text-xs px-3 py-1.5 rounded-full">
              ⚠️ Modo offline — dados serão sincronizados quando houver conexão
            </div>
          )}
          {processingId && (
            <div className="mt-3 inline-flex items-center gap-2 bg-cyan-900/50 border border-cyan-700 text-cyan-200 text-xs px-3 py-1.5 rounded-full">
              ⏳ Processando o arquivo em segundo plano
            </div>
          )}
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-white text-sm uppercase tracking-wider">+ Novo Fluxograma</h2>

          <input
            type="text"
            placeholder="Nome do fluxograma (ex: P&ID Área 1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-500 outline-none focus:ring-2 focus:ring-orange-500 transition"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => {
              if (name.trim()) fileRef.current?.click();
              else addNotification('Informe o nome primeiro', 'warning');
            }}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none
              ${dragOver
                ? 'border-orange-400 bg-orange-500/10'
                : 'border-gray-600 hover:border-orange-500 hover:bg-gray-700/30'}
            `}
          >
            <div className="text-3xl mb-2">📁</div>
            <p className="text-sm text-gray-300 font-medium">
              {uploading ? 'Criando...' : 'Arraste uma imagem ou PDF aqui'}
            </p>
            <p className="text-xs text-gray-500 mt-1">ou clique para selecionar</p>
            <p className="text-xs text-gray-600 mt-2">PNG, JPG, PDF — até 25MB</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                if (name.trim()) fileRef.current?.click();
                else addNotification('Informe o nome primeiro', 'warning');
              }}
              disabled={uploading}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm py-2.5 rounded-xl transition"
            >
              {uploading ? '⏳ Criando...' : '📁 Selecionar Arquivo'}
            </button>

            <button
              onClick={() => createFluxogram(null)}
              disabled={uploading || !name.trim()}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm py-2.5 rounded-xl font-semibold transition"
            >
              Criar sem imagem →
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {fluxograms.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-400 text-xs uppercase tracking-wider mb-3">
              Fluxogramas Existentes ({fluxograms.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fluxograms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setCurrentFluxogram(f)}
                  className="bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500/50 rounded-xl p-4 text-left transition-all group"
                >
                  {f.image_url ? (
                    <div className="w-full h-20 bg-gray-900 rounded-lg mb-3 overflow-hidden">
                      <img
                        src={api.resolveUrl(f.image_url)}
                        alt={f.name}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-20 bg-gray-900 rounded-lg mb-3 flex items-center justify-center text-3xl opacity-40 group-hover:opacity-70 transition">
                      🗺️
                    </div>
                  )}
                  <p className="font-semibold text-white text-sm truncate">{f.name}</p>
                  <p className="text-xs text-gray-500 mt-1 group-hover:text-orange-400 transition">
                    Abrir fluxograma →
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
