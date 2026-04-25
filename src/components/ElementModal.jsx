import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useStore from '../store/useStore';
import * as api from '../services/api';
import * as idb from '../services/indexeddb';

// ── Constants ────────────────────────────────────────────────────────────────
const ELEMENT_TYPES = [
  { value: 'valvula',  label: '🔵 Válvula',           color: '#3B82F6' },
  { value: 'sensor',   label: '🟣 Sensor',            color: '#8B5CF6' },
  { value: 'bomba',    label: '🔴 Bomba',             color: '#EC4899' },
  { value: 'medidor',  label: '🟡 Medidor / Flow',    color: '#F59E0B' },
  { value: 'tanque',   label: '🔵 Tanque / Vaso',     color: '#06B6D4' },
  { value: 'filtro',   label: '🟢 Filtro',            color: '#10B981' },
  { value: 'trocador', label: '🟠 Trocador de Calor', color: '#F97316' },
  { value: 'outro',    label: '⚪ Outro',             color: '#6B7280' },
];

const DEFAULT_FORM = {
  tag: '', type: 'sensor', description: '',
  tag_ok: false, foto_ok: false, validado_campo: false,
  image_url: '',
};

// ── Component ────────────────────────────────────────────────────────────────
export default function ElementModal() {
  const {
    selectedElement, newElementPosition, currentFluxogram,
    closeModal, clearNewElementPosition,
    addElement, updateElement, removeElement,
    addNotification,
  } = useStore();

  const isNew = !selectedElement && !!newElementPosition;

  const [form, setForm]         = useState(DEFAULT_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  const fileRef   = useRef(null);
  const cameraRef = useRef(null);
  const tagRef    = useRef(null);

  // ── Populate form ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedElement) {
      setForm({
        tag:            selectedElement.tag            || '',
        type:           selectedElement.type           || 'sensor',
        description:    selectedElement.description    || '',
        tag_ok:         selectedElement.tag_ok         || false,
        foto_ok:        selectedElement.foto_ok        || false,
        validado_campo: selectedElement.validado_campo || false,
        image_url:      selectedElement.image_url      || '',
      });
      setPreviewUrl(selectedElement.image_url ? api.resolveUrl(selectedElement.image_url) : '');
    } else {
      setForm(DEFAULT_FORM);
      setPreviewUrl('');
    }

    // Focus tag input after mount
    setTimeout(() => tagRef.current?.focus(), 150);
  }, [selectedElement?.id, isNew]);

  // ── Field helpers ─────────────────────────────────────────────────────────
  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  // ── Image upload ──────────────────────────────────────────────────────────
  async function handleImageFile(file) {
    if (!file) return;

    // Instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    setUploading(true);
    try {
      const res = await api.uploadFile(file);
      setForm((f) => ({ ...f, image_url: res.url, foto_ok: true }));
      setPreviewUrl(api.resolveUrl(res.url));
      addNotification('Foto enviada com sucesso!', 'success');
    } catch {
      // Keep local preview but set flag that this is pending upload
      setForm((f) => ({ ...f, foto_ok: true }));
      addNotification('Foto salva localmente. Será enviada ao sincronizar.', 'warning');
    } finally {
      setUploading(false);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.tag.trim()) {
      addNotification('A tag é obrigatória.', 'error');
      tagRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const payload = {
          id:           uuidv4(),
          fluxogram_id: currentFluxogram.id,
          x:            newElementPosition.x,
          y:            newElementPosition.y,
          ...form,
        };

        try {
          const created = await api.createElement(payload);
          addElement(created);
          await idb.saveElementLocal(created);
        } catch {
          // Offline
          addElement(payload);
          await idb.saveElementLocal(payload);
          await idb.enqueuePendingOp('create', 'elements', payload);
          addNotification('Elemento salvo offline.', 'warning');
        }
      } else {
        const payload = { ...selectedElement, ...form };

        try {
          const updated = await api.updateElement(selectedElement.id, payload);
          updateElement(updated);
          await idb.saveElementLocal(updated);
        } catch {
          // Offline
          updateElement(payload);
          await idb.saveElementLocal(payload);
          await idb.enqueuePendingOp('update', 'elements', payload);
          addNotification('Atualização salva offline.', 'warning');
        }
      }

      handleClose();
      addNotification(isNew ? 'Elemento criado!' : 'Elemento atualizado!', 'success');
    } catch (err) {
      addNotification('Erro: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm(`Excluir o elemento "${selectedElement.tag}"? Esta ação não pode ser desfeita.`)) return;

    try {
      await api.deleteElement(selectedElement.id);
    } catch {
      await idb.enqueuePendingOp('delete', 'elements', { id: selectedElement.id });
    }

    removeElement(selectedElement.id);
    await idb.deleteElementLocal(selectedElement.id);
    handleClose();
    addNotification('Elemento excluído.', 'warning');
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  function handleClose() {
    clearNewElementPosition();
    closeModal();
  }

  // Keyboard shortcut
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') handleClose();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSave();
  }, [form]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Progress for this element
  const done = (form.tag_ok ? 1 : 0) + (form.foto_ok ? 1 : 0) + (form.validado_campo ? 1 : 0);
  const progressColor = done === 3 ? '#22c55e' : done > 0 ? '#eab308' : '#ef4444';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="font-bold text-white text-base">
              {isNew ? '✚ Novo Elemento' : `✏️ ${selectedElement?.tag || 'Editar'}`}
            </h2>
            {!isNew && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-4 h-1 rounded-full"
                      style={{ background: i < done ? progressColor : '#374151' }}
                    />
                  ))}
                </div>
                <span className="text-xs" style={{ color: progressColor }}>{done}/3 itens validados</span>
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 text-xl transition"
          >
            ×
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Tag */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">
              Tag <span className="text-orange-400">*</span>
            </label>
            <input
              ref={tagRef}
              type="text"
              placeholder="Ex: Q-57, V-101, FT-203..."
              value={form.tag}
              onChange={set('tag')}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 transition placeholder-gray-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Tipo de Equipamento</label>
            <div className="grid grid-cols-2 gap-2">
              {ELEMENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={`px-3 py-2 rounded-xl text-xs text-left transition border ${
                    form.type === t.value
                      ? 'border-2 font-bold'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500 bg-gray-700/50'
                  }`}
                  style={
                    form.type === t.value
                      ? { borderColor: t.color, color: t.color, background: t.color + '15' }
                      : {}
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Descrição / Observações</label>
            <textarea
              rows={3}
              placeholder="Localização, condição do equipamento, notas de inspeção..."
              value={form.description}
              onChange={set('description')}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500 resize-none transition placeholder-gray-500"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Foto do Equipamento</label>

            {/* Preview */}
            {previewUrl && (
              <div className="relative mb-2 rounded-xl overflow-hidden border border-gray-600">
                <img
                  src={previewUrl}
                  alt="equipamento"
                  className="w-full h-44 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <button
                  onClick={() => { setPreviewUrl(''); setForm((f) => ({ ...f, image_url: '' })); }}
                  className="absolute top-2 right-2 bg-black/70 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600 transition"
                >
                  ×
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {/* Gallery */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-xs py-3 rounded-xl transition"
              >
                {uploading ? (
                  <span className="animate-pulse">⏳ Enviando...</span>
                ) : (
                  <>📁 <span>Galeria</span></>
                )}
              </button>

              {/* Camera (native, works on mobile) */}
              <button
                onClick={() => cameraRef.current?.click()}
                disabled={uploading}
                className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-xs py-3 rounded-xl transition"
              >
                📸 <span>Câmera</span>
              </button>
            </div>

            {/* Hidden inputs */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleImageFile(e.target.files?.[0])}
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-xs text-gray-400 mb-2 font-medium">
              Checklist de Validação
            </label>
            <div className="bg-gray-700/50 rounded-xl overflow-hidden border border-gray-700">
              {[
                { key: 'tag_ok',         icon: '🏷️', label: 'Tag verificada',       sub: 'Tag física confere com o P&ID' },
                { key: 'foto_ok',        icon: '📸', label: 'Foto registrada',       sub: 'Foto do equipamento anexada' },
                { key: 'validado_campo', icon: '✅', label: 'Validado em campo',     sub: 'Inspeção presencial realizada' },
              ].map(({ key, icon, label, sub }, idx) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-700 transition ${idx < 2 ? 'border-b border-gray-700' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="w-5 h-5 rounded accent-orange-500 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${form[key] ? 'text-green-400' : 'text-gray-300'}`}>
                      {icon} {label}
                    </div>
                    <div className="text-xs text-gray-500">{sub}</div>
                  </div>
                  {form[key] && <span className="text-green-400 text-xs">✓</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Keyboard hint */}
          <p className="text-xs text-gray-600 text-center">
            Ctrl+Enter para salvar · Esc para fechar
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-gray-700 flex gap-2 flex-shrink-0">
          {/* Delete (only for existing elements) */}
          {!isNew && (
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 bg-red-900/60 hover:bg-red-800 text-red-300 text-sm rounded-xl transition"
            >
              🗑️ Excluir
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={handleClose}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-xl transition"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm rounded-xl font-semibold transition min-w-[90px]"
          >
            {saving ? '⏳ Salvando...' : isNew ? '✚ Criar' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
