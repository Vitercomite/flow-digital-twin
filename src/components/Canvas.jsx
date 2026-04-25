import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Circle, Group, Text, Rect } from 'react-konva';
import useImage from 'use-image';
import useStore from '../store/useStore';
import { resolveUrl } from '../services/api';
import { normalizeTag } from '../data/legendMap';

const ELEMENT_TYPE_COLORS = {
  valvula: '#3B82F6',
  sensor: '#8B5CF6',
  bomba: '#EC4899',
  medidor: '#F59E0B',
  tanque: '#06B6D4',
  filtro: '#10B981',
  trocador: '#F97316',
  outro: '#6B7280',
};

const STATUS_COLORS = { green: '#22C55E', yellow: '#EAB308', red: '#EF4444' };

function getStatus(el) {
  const done = (el.tag_ok ? 1 : 0) + (el.foto_ok ? 1 : 0) + (el.validado_campo ? 1 : 0);
  return done === 3 ? 'green' : done > 0 ? 'yellow' : 'red';
}

function ElementDot({ element, onHover, onHoverEnd, onClick, highlighted }) {
  const status = getStatus(element);
  const ringColor = highlighted ? '#22D3EE' : STATUS_COLORS[status];
  const dotColor = ELEMENT_TYPE_COLORS[element.type] || ELEMENT_TYPE_COLORS.outro;

  return (
    <Group
      x={element.x}
      y={element.y}
      onMouseEnter={(e) => {
        const stage = e.target.getStage();
        onHover(element, stage.getPointerPosition());
        stage.container().style.cursor = 'pointer';
      }}
      onMouseLeave={(e) => {
        onHoverEnd();
        e.target.getStage().container().style.cursor = 'default';
      }}
      onClick={() => onClick(element)}
      onTap={() => onClick(element)}
    >
      {highlighted && <Circle radius={30} fill="#22D3EE" opacity={0.12} />}
      <Circle radius={22} fill={ringColor} opacity={highlighted ? 0.22 : 0.15} />
      <Circle radius={16} fill="transparent" stroke={ringColor} strokeWidth={highlighted ? 4 : 2.5} />
      <Circle radius={11} fill={dotColor} />
      <Rect x={-28} y={18} width={56} height={14} fill="rgba(0,0,0,0.7)" cornerRadius={3} />
      <Text
        text={element.tag || '?'}
        x={-28}
        y={20}
        width={56}
        align="center"
        fontSize={9}
        fill="white"
        fontStyle="bold"
      />
    </Group>
  );
}

export default function Canvas({ onAddElement }) {
  const {
    currentFluxogram,
    elements,
    mode,
    openModal,
    setHovered,
    clearHovered,
    setLensDraft,
    lensFocusTag,
    lensFocusElementId,
  } = useStore();

  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPhotoDropActive, setIsPhotoDropActive] = useState(false);

  const rawUrl = currentFluxogram?.image_url || '';
  const imageUrl = rawUrl ? resolveUrl(rawUrl) : '';
  const [bgImage, imgStatus] = useImage(imageUrl, 'anonymous');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    });
    ro.observe(el);
    setSize({ width: el.offsetWidth, height: el.offsetHeight });

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!bgImage || !size.width || !size.height) return;

    const { naturalWidth: imgW, naturalHeight: imgH } = bgImage;
    const ratio = Math.min((size.width * 0.95) / imgW, (size.height * 0.95) / imgH, 1);
    setScale(ratio);
    setPos({ x: (size.width - imgW * ratio) / 2, y: (size.height - imgH * ratio) / 2 });
  }, [bgImage, size.width, size.height]);

  const handleWheel = useCallback((e) => {
    e.evt.preventDefault();
    const FACTOR = 1.07;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * FACTOR : oldScale / FACTOR;
    const clamped = Math.max(0.05, Math.min(20, newScale));

    setScale(clamped);
    setPos({ x: pointer.x - mousePointTo.x * clamped, y: pointer.y - mousePointTo.y * clamped });
  }, []);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsPhotoDropActive(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const rect = containerRef.current?.getBoundingClientRect?.();
    const clientX = e.clientX ?? (rect ? rect.left + rect.width / 2 : 0);
    const clientY = e.clientY ?? (rect ? rect.top + rect.height / 2 : 0);

    const x = rect ? (clientX - rect.left - pos.x) / scale : (size.width || 0) / 2;
    const y = rect ? (clientY - rect.top - pos.y) / scale : (size.height || 0) / 2;

    setLensDraft({
      file,
      x,
      y,
      previewUrl: URL.createObjectURL(file),
      createdAt: Date.now(),
    });
  }, [setLensDraft, pos.x, pos.y, scale, size.width, size.height]);

  const handleStageClick = useCallback((e) => {
    if (mode !== 'add') return;
    if (isDragging) return;

    const className = e.target.getClassName();
    if (!['Image', 'Stage'].includes(className)) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    const x = (pointer.x - stage.x()) / stage.scaleX();
    const y = (pointer.y - stage.y()) / stage.scaleY();

    onAddElement({ x, y });
  }, [mode, isDragging, onAddElement]);

  function resetView() {
    if (!bgImage || !size.width) return;
    const { naturalWidth: imgW, naturalHeight: imgH } = bgImage;
    const ratio = Math.min((size.width * 0.95) / imgW, (size.height * 0.95) / imgH, 1);
    setScale(ratio);
    setPos({ x: (size.width - imgW * ratio) / 2, y: (size.height - imgH * ratio) / 2 });
  }

  const targetTag = normalizeTag(lensFocusTag || '');

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-gray-950"
      style={{ cursor: mode === 'add' ? 'crosshair' : 'default' }}
      onDragOver={(e) => { e.preventDefault(); setIsPhotoDropActive(true); }}
      onDragLeave={() => setIsPhotoDropActive(false)}
      onDrop={handleFileDrop}
    >
      {mode === 'add' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none bg-orange-500/90 backdrop-blur text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-xl">
          ✚ Clique no fluxograma para adicionar um ponto
        </div>
      )}

      {lensFocusTag && (
        <div className="absolute top-3 right-3 z-20 bg-cyan-500/15 border border-cyan-400/40 text-cyan-100 rounded-2xl px-3 py-2 shadow-xl max-w-[280px]">
          <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-semibold">Lens focus</p>
          <p className="text-sm font-semibold">{lensFocusTag}</p>
        </div>
      )}

      {isPhotoDropActive && (
        <div className="absolute inset-0 z-20 pointer-events-none border-2 border-dashed border-orange-400 bg-orange-500/10 flex items-center justify-center">
          <div className="bg-gray-900/90 border border-orange-400 rounded-2xl px-4 py-3 text-center shadow-2xl">
            <p className="text-white text-sm font-semibold">Solte a foto para analisar com a simbologia</p>
            <p className="text-orange-200 text-xs mt-1">O Lens vai sugerir o tipo e a tag automaticamente</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button onClick={() => setScale((s) => Math.min(s * 1.2, 20))} className="w-9 h-9 bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg text-lg flex items-center justify-center shadow">+</button>
        <button onClick={() => setScale((s) => Math.max(s / 1.2, 0.05))} className="w-9 h-9 bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg text-lg flex items-center justify-center shadow">−</button>
        <button onClick={resetView} className="w-9 h-9 bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg text-xs flex items-center justify-center shadow">⊡</button>
      </div>

      {!imageUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-600 space-y-2">
            <div className="text-5xl">🗺️</div>
            <p className="text-sm">Nenhuma imagem carregada</p>
            <p className="text-xs">Faça upload ao criar o fluxograma</p>
          </div>
        </div>
      )}

      {imageUrl && imgStatus === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-gray-500 text-sm animate-pulse">Carregando imagem...</p>
        </div>
      )}

      {size.width > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          scaleX={scale}
          scaleY={scale}
          x={pos.x}
          y={pos.y}
          draggable={mode === 'view'}
          onWheel={handleWheel}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={(e) => {
            setPos({ x: e.target.x(), y: e.target.y() });
            setTimeout(() => setIsDragging(false), 50);
          }}
        >
          <Layer>
            {bgImage && <KonvaImage image={bgImage} width={bgImage.naturalWidth} height={bgImage.naturalHeight} />}
            {elements.map((el) => {
              const isFocus = Boolean(
                (lensFocusElementId && el.id === lensFocusElementId) ||
                (targetTag && normalizeTag(el.tag || '') === targetTag)
              );
              return (
                <ElementDot
                  key={el.id}
                  element={el}
                  highlighted={isFocus}
                  onHover={(element, p) => setHovered(element, p)}
                  onHoverEnd={clearHovered}
                  onClick={openModal}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
