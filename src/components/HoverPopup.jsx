import React from 'react';
import useStore from '../store/useStore';

// ── Constants (inline to avoid shared import issues in browser) ───────────────
const STATUS_COLORS = { green: '#22C55E', yellow: '#EAB308', red: '#EF4444' };

const ELEMENT_TYPES = {
  valvula:  { label: 'Válvula',           color: '#3B82F6' },
  sensor:   { label: 'Sensor',            color: '#8B5CF6' },
  bomba:    { label: 'Bomba',             color: '#EC4899' },
  medidor:  { label: 'Medidor / Flow',    color: '#F59E0B' },
  tanque:   { label: 'Tanque / Vaso',     color: '#06B6D4' },
  filtro:   { label: 'Filtro',            color: '#10B981' },
  trocador: { label: 'Trocador de Calor', color: '#F97316' },
  outro:    { label: 'Outro',             color: '#6B7280' },
};

function getStatus(el) {
  const done = (el.tag_ok ? 1 : 0) + (el.foto_ok ? 1 : 0) + (el.validado_campo ? 1 : 0);
  if (done === 3) return 'green';
  if (done > 0) return 'yellow';
  return 'red';
}

export default function HoverPopup() {
  const { hoveredElement, hoverScreenPos } = useStore();

  if (!hoveredElement || !hoverScreenPos) return null;

  const status   = getStatus(hoveredElement);
  const typeInfo = ELEMENT_TYPES[hoveredElement.type] || ELEMENT_TYPES.outro;

  // Adjust position so popup doesn't go off-screen edges
  const left = Math.min(hoverScreenPos.x + 18, window.innerWidth - 220);
  const top  = Math.max(hoverScreenPos.y - 10, 8);

  return (
    <div
      className="fixed z-40 pointer-events-none"
      style={{ left, top }}
    >
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl p-3 w-52 text-sm">
        {/* Tag & status */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: STATUS_COLORS[status] }}
          />
          <span className="font-bold text-white text-base truncate">{hoveredElement.tag || '—'}</span>
        </div>

        {/* Type badge */}
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{
            background: typeInfo.color + '25',
            color: typeInfo.color,
            border: `1px solid ${typeInfo.color}55`,
          }}
        >
          {typeInfo.label}
        </span>

        {/* Description */}
        {hoveredElement.description && (
          <p className="text-gray-400 text-xs mt-2 line-clamp-2">{hoveredElement.description}</p>
        )}

        {/* Checklist summary */}
        <div className="mt-3 space-y-1">
          {[
            ['tag_ok',         '🏷️ Tag verificada'],
            ['foto_ok',        '📸 Foto registrada'],
            ['validado_campo', '✅ Validado em campo'],
          ].map(([key, label]) => (
            <div
              key={key}
              className={`text-xs flex items-center gap-1.5 ${hoveredElement[key] ? 'text-green-400' : 'text-gray-500'}`}
            >
              <span>{hoveredElement[key] ? '●' : '○'}</span>
              {label}
            </div>
          ))}
        </div>

        <p className="text-gray-600 text-xs mt-3 italic">Clique para editar</p>
      </div>
    </div>
  );
}
