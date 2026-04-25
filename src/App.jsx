import React, { useEffect, useState } from 'react';
import useStore from './store/useStore';
import useSocket from './hooks/useSocket';
import useOfflineSync from './hooks/useOfflineSync';
import * as api from './services/api';
import * as idb from './services/indexeddb';
import Header from './components/Header';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import ElementModal from './components/ElementModal';
import HoverPopup from './components/HoverPopup';
import FluxogramUpload from './components/FluxogramUpload';
import Notifications from './components/Notifications';
import FieldLensDock from './components/FieldLensDock';

export default function App() {
  const {
    currentFluxogram,
    setFluxograms,
    setElements,
    setNewElementPosition,
    clearLensFocus,
    isModalOpen,
  } = useStore();

  const [loading, setLoading] = useState(true);

  useSocket();
  useOfflineSync();

  useEffect(() => {
    async function loadFluxograms() {
      const remotePromise = api.getFluxograms();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 8000);
      });

      try {
        const data = await Promise.race([remotePromise, timeoutPromise]);
        setFluxograms(data);
        await Promise.all(data.map((f) => idb.saveFluxogramLocal(f)));
      } catch {
        const local = await idb.getFluxogramsLocal();
        setFluxograms(local);
      } finally {
        setLoading(false);
      }
    }
    loadFluxograms();
  }, []);

  useEffect(() => {
    if (!currentFluxogram) {
      setElements([]);
      clearLensFocus();
      return;
    }

    async function loadElements() {
      const remotePromise = api.getElementsByFluxogram(currentFluxogram.id);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 8000);
      });

      try {
        const data = await Promise.race([remotePromise, timeoutPromise]);
        setElements(data);
        await Promise.all(data.map((el) => idb.saveElementLocal(el)));
      } catch {
        const local = await idb.getElementsLocal(currentFluxogram.id);
        setElements(local);
      }
    }

    loadElements();
  }, [currentFluxogram?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center space-y-4">
          <div className="text-5xl animate-spin inline-block">⚙️</div>
          <p className="text-gray-400 text-sm">Inicializando FlowTwin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-900">
      <Header />

      {!currentFluxogram ? (
        <FluxogramUpload />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden sm:flex">
            <Sidebar />
          </div>

          <Canvas onAddElement={(pos) => setNewElementPosition(pos)} />
        </div>
      )}

      {currentFluxogram && (
        <div className="sm:hidden border-t border-gray-700 h-40 overflow-y-auto">
          <Sidebar />
        </div>
      )}

      {isModalOpen && <ElementModal />}
      <HoverPopup />
      <FieldLensDock />
      <Notifications />
    </div>
  );
}
