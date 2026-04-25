import React, { useState } from 'react';
import useStore from '../store/useStore';

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_COLORS = { green: '#22C55E', yellow: '#EAB308', red: '#EF4444' };

const ELEMENT_TYPES = {
  valvula:  { label: 'Válvula',           color: '#3B82F6' },
  sensor:   { label: 'Sensor',            color: '#8B5CF6' },
  bomba:    { label: 'Bomba',             color: '#EC4899' },
  medidor:  { label: 'Medidor',           color: '#F59E0B' },
  tanque:   { label: 'Tanque',            color: '#06B6D4' },
  filtro:   { label: 'Filtro',            color: '#10B981' },
  trocador: { label: 'Trocador',          color: '#F97316' },
  outro:    { label: 'Outro',             color: '#6B7280' },
};

function getStatus(el) {
  const done = (el.tag_ok ? 1 : 0) + (el.foto_ok ? 1 : 0) + (el.validado_campo ? 1 : 0);
  if (done === 3) return 'green';
  if (done > 0) return 'yellow';
  return 'red';
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const { elements, openModal } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'ok' | 'partial' | 'pending'
  const [collapsed, setCollapsed] = useState(false);

  const filtered = elements.filter((el) => {
    const q = search.toLowerCase();
    const matchSearch =
      (el.tag || '').toLowerCase().includes(q) ||
      (el.description || '').toLowerCase().includes(q) ||
      (el.type || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    const status = getStatus(el);
    if (filter === 'ok')      return status === 'green';
    if (filter === 'partial') return status === 'yellow';
    if (filter === 'pending') return status === 'red';
    return true;
  });

  // Stats
  const total   = elements.length;
  const okCount = elements.filter((e) => getStatus(e) === 'green').length;
  const partialCount = elements.filter((e) => getStatus(e) === 'yellow').length;
  const pendingCount = elements.filter((e) => getStatus(e) === 'red').length;

  if (collapsed) {
    return (
      <div className="w-10 bg-gray-800 border-r border-gray-700 flex flex-col items-center py-4 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-400 hover:text-white text-lg"
          title="Expandir lista"
        >
          »
        </button>
        <div className="writing-mode-vertical text-xs text-gray-500 mt-4" style={{ writingMode: 'vertical-rl' }}>
          {total} elem.
        </div>
      </div>
    );
  }

  return (
    <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Elementos ({total})
          </span>
          <button onClick={() => setCollapsed(true)} className="text-gray-500 hover:text-white text-xs px-1">
            «
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-1.5 text-xs">
          <span className="flex items-center gap-1 text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            {okCount}
          </span>
          <span className="flex items-center gap-1 text-yellow-400">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
            {partialCount}
          </span>
          <span className="flex items-center gap-1 text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            {pendingCount}
          </span>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Buscar tag, tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-700 text-white text-xs rounded-lg px-3 py-2 placeholder-gray-500 outline-none focus:ring-1 focus:ring-orange-500"
        />

        {/* Filter pills */}
        <div className="flex gap-1 flex-wrap">
          {[
            ['all',     'Todos'],
            ['ok',      '✅ OK'],
            ['partial', '⚠️ Parcial'],
            ['pending', '❌ Pendente'],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={`text-xs px-2 py-0.5 rounded-full transition ${
                filter === v
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {search || filter !== 'all' ? 'Nenhum resultado' : 'Nenhum elemento.\nUse o modo Adicionar para criar.'}
          </div>
        ) : (
          filtered.map((el) => {
            const status   = getStatus(el);
            const typeInfo = ELEMENT_TYPES[el.type] || ELEMENT_TYPES.outro;
            const done     = (el.tag_ok ? 1 : 0) + (el.foto_ok ? 1 : 0) + (el.validado_campo ? 1 : 0);

            return (
              <button
                key={el.id}
                onClick={() => openModal(el)}
                className="w-full text-left px-3 py-2.5 border-b border-gray-700/60 hover:bg-gray-700/50 transition-colors flex items-start gap-2.5 group"
              >
                {/* Status dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: STATUS_COLORS[status] }}
                />

                <div className="flex-1 min-w-0">
                  {/* Tag + type */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-white truncate">{el.tag || '—'}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                      style={{ background: typeInfo.color + '22', color: typeInfo.color }}
                    >
                      {typeInfo.label}
                    </span>
                  </div>

                  {/* Description */}
                  {el.description ? (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{el.description}</p>
                  ) : null}

                  {/* Checklist mini-bar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex gap-1">
                      {[el.tag_ok, el.foto_ok, el.validado_campo].map((ok, i) => (
                        <div
                          key={i}
                          className="w-3 h-1.5 rounded-full"
                          style={{ background: ok ? STATUS_COLORS.green : '#374151' }}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-gray-500">{done}/3</span>
                  </div>
                </div>

                {/* Arrow on hover */}
                <span className="text-gray-600 group-hover:text-orange-400 transition text-xs flex-shrink-0 mt-1">›</span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
