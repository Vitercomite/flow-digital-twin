export const LEGEND_ENTRIES = [
  {
    type: 'valvula',
    label: 'Válvula / Registro',
    keywords: ['valve', 'válvula', 'valvula', 'ball valve', 'gate valve', 'butterfly', 'shutoff', 'control valve', 'solenoid', 'registo'],
    tags: ['V', 'Q', 'XV', 'CV', 'MV'],
    color: '#3B82F6',
    icon: '🔵',
  },
  {
    type: 'sensor',
    label: 'Instrumento / Sensor',
    keywords: ['sensor', 'transmitter', 'transducer', 'indicator', 'probe', 'meter', 'temperature', 'pressure', 'level', 'flow', 'ti', 'pi', 'fi', 'li', 'pt', 'tt', 'ft', 'lt', 'pdi', 'psal', 'tic', 'pic', 'fic', 'lic'],
    tags: ['TIC', 'TI', 'PI', 'FI', 'LI', 'PT', 'TT', 'FT', 'LT', 'PDI', 'PSAL'],
    color: '#8B5CF6',
    icon: '🟣',
  },
  {
    type: 'bomba',
    label: 'Bomba / Compressor / Fan',
    keywords: ['pump', 'bomba', 'compressor', 'fan', 'blower', 'ventilator', 'centrifugal', 'gear pump'],
    tags: ['P', 'G', 'K', 'M'],
    color: '#EC4899',
    icon: '🔴',
  },
  {
    type: 'medidor',
    label: 'Medidor / Medição',
    keywords: ['meter', 'measurement', 'gauge', 'manometer', 'thermometer', 'flowmeter', 'indicator'],
    tags: ['PI', 'TI', 'FI', 'LI'],
    color: '#F59E0B',
    icon: '🟡',
  },
  {
    type: 'tanque',
    label: 'Tanque / Vaso / Recipiente',
    keywords: ['tank', 'vessel', 'reservoir', 'container', 'basin', 'accumulator', 'expansion vessel', 'boiler'],
    tags: ['T', 'V', 'B'],
    color: '#06B6D4',
    icon: '🔵',
  },
  {
    type: 'filtro',
    label: 'Filtro / Separador',
    keywords: ['filter', 'strainer', 'separator', 'cyclone', 'demister', 'mesh', 'screen'],
    tags: ['H', 'S', 'Z'],
    color: '#10B981',
    icon: '🟢',
  },
  {
    type: 'trocador',
    label: 'Trocador / Aquecimento',
    keywords: ['heat exchanger', 'heater', 'cooler', 'burner', 'heat', 'exchange', 'coil', 'furnace'],
    tags: ['E', 'W', 'X'],
    color: '#F97316',
    icon: '🟠',
  },
];

export const DEFAULT_LENS_LABEL = {
  type: 'outro',
  label: 'Elemento não classificado',
  color: '#6B7280',
  icon: '⚪',
};

export function normalizeText(value = '') {
  return String(value)
    .toUpperCase()
    .replace(/[_/\\]+/g, ' ')
    .replace(/[^A-Z0-9\-\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTag(tag = '') {
  const normalized = normalizeText(tag).replace(/\s+/g, '');
  const match = normalized.match(/([A-Z]{1,4})-?0*([0-9]{1,4})/);
  if (!match) return normalized;
  return `${match[1]}-${String(Number(match[2])).padStart(3, '0')}`;
}

export function extractTagCandidates(text = '') {
  const haystack = normalizeText(text);
  const candidates = new Set();
  const regex = /\b([A-Z]{1,4})[-\s]?0*(\d{1,4})\b/g;
  let match;
  while ((match = regex.exec(haystack))) {
    candidates.add(normalizeTag(`${match[1]}-${match[2]}`));
  }
  return [...candidates];
}

export function detectLegendMatch(text = '') {
  const haystack = normalizeText(text);
  let best = { ...DEFAULT_LENS_LABEL, score: 0, reason: 'Sem correspondência forte' };

  for (const entry of LEGEND_ENTRIES) {
    let score = 0;
    const hits = [];
    for (const keyword of entry.keywords) {
      if (haystack.includes(normalizeText(keyword))) {
        score += keyword.length >= 6 ? 14 : 10;
        hits.push(keyword);
      }
    }

    if (entry.type === 'sensor' && /\b(TI|PI|FI|LI|TT|PT|FT|LT|PDI|PSAL|TIC|PIC|FIC|LIC)\b/i.test(haystack)) {
      score += 18;
      hits.push('instrument tag');
    }
    if (entry.type === 'bomba' && /\b(P|PUMP|BOMBA)[-\s]?\d+/i.test(haystack)) {
      score += 16;
      hits.push('pump tag');
    }
    if (entry.type === 'valvula' && /\b(V|Q|VALVE)[-\s]?\d+/i.test(haystack)) {
      score += 16;
      hits.push('valve tag');
    }

    if (score > best.score) {
      best = {
        ...entry,
        score,
        reason: hits.length ? `Match: ${hits.slice(0, 3).join(', ')}` : 'Match lexical',
      };
    }
  }

  return best;
}

export function buildNextTag({ type, existingElements = [] }) {
  const prefixes = {
    valvula: ['V', 'Q', 'XV', 'CV'],
    sensor: ['TI', 'PI', 'FI', 'LI', 'TT', 'PT', 'FT', 'LT'],
    bomba: ['P', 'K', 'G'],
    medidor: ['PI', 'TI', 'FI', 'LI'],
    tanque: ['T', 'V'],
    filtro: ['H', 'S', 'Z'],
    trocador: ['E', 'W', 'X'],
    outro: ['X'],
  };

  const prefix = prefixes[type]?.[0] || 'X';
  const used = existingElements
    .map((el) => normalizeTag(el.tag || ''))
    .filter((tag) => tag.startsWith(prefix))
    .map((tag) => {
      const m = tag.match(/(\d{1,4})/);
      return m ? Number(m[1]) : null;
    })
    .filter(Number.isFinite);

  const next = used.length ? Math.max(...used) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export function findElementByTag(elements = [], tag = '') {
  const target = normalizeTag(tag);
  return elements.find((el) => normalizeTag(el.tag || '') === target) || null;
}
