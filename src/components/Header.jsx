import React from 'react';
import useStore from '../store/useStore';
import { syncPendingOps } from '../services/sync';

function calcProgress(elements) {
  if (!elements.length) return 0;
  const total = elements.length * 3;
  const done = elements.reduce(
    (sum, el) => sum + (el.tag_ok ? 1 : 0) + (el.foto_ok ? 1 : 0) + (el.validado_campo ? 1 : 0),
    0
  );
  return Math.round((done / total) * 100);
}

export default function Header() {
  const {
    currentFluxogram,
    setCurrentFluxogram,
    setElements,
    elements,
    mode,
    setMode,
    isOnline,
    pendingCount,
    setPendingCount,
    addNotification,
  } = useStore();

  const progress = calcProgress(elements);

  const progressColor =
    progress === 100 ? '#22c55e' : progress >= 50 ? '#eab308' : '#ef4444';

  async function handleSync() {
    try {
      const { synced, failed } = await syncPendingOps();
      const count = await import('../services/sync').then((m) => m.getPendingCount());
      setPendingCount(count);
      addNotification(
        failed > 0
          ? `${synced} sincronizado(s), ${failed} falha(s)`
          : `${synced} operação(ões) sincronizada(s)`,
        failed > 0 ? 'warning' : 'success'
      );
    } catch {
      addNotification('Erro ao sincronizar', 'error');
    }
  }

  return (
    <header className="bg-gray-800 border-b border-gray-700 flex-shrink-0">
      {/* Top row */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-orange-400 font-black text-base tracking-tight whitespace-nowrap">
            ⚡ FlowTwin
          </span>
          {currentFluxogram && (
            <>
              <span className="text-gray-600 hidden sm:inline">/</span>
              <span className="text-gray-300 text-sm font-medium truncate hidden sm:block max-w-[160px]">
                {currentFluxogram.name}
              </span>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Online indicator */}
          <div
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
              isOnline ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Pending sync badge */}
          {pendingCount > 0 && (
            <button
              onClick={handleSync}
              title="Clique para sincronizar agora"
              className="flex items-center gap-1 text-xs bg-yellow-800/60 hover:bg-yellow-700 text-yellow-200 px-2.5 py-1 rounded-full transition"
            >
              🔄 {pendingCount}
            </button>
          )}

          {/* Add / View mode toggle */}
          {currentFluxogram && (
            <button
              onClick={() => setMode(mode === 'add' ? 'view' : 'add')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                mode === 'add'
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {mode === 'add' ? '✚ Adicionando' : '📍 + Ponto'}
            </button>
          )}

          {/* Back to list */}
          {currentFluxogram && (
            <button
              onClick={() => {
                setCurrentFluxogram(null);
                setElements([]);
                setMode('view');
              }}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition"
            >
              ← Lista
            </button>
          )}
        </div>
      </div>

      {/* Progress bar row */}
      {currentFluxogram && elements.length > 0 && (
        <div className="px-4 pb-2.5 flex items-center gap-3">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {elements.length} elem.
          </span>
          <div className="flex-1 bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: progressColor }}
            />
          </div>
          <span className="text-xs font-bold w-9 text-right" style={{ color: progressColor }}>
            {progress}%
          </span>
        </div>
      )}
    </header>
  );
}
