import {
  buildNextTag,
  detectLegendMatch,
  extractTagCandidates,
  findElementByTag,
  normalizeText,
} from '../data/legendMap';

function scoreFromFilename(fileName = '') {
  const text = normalizeText(fileName);
  const evidence = [];
  let score = 0;

  if (/(flame|burner|heater|hot box|forno|aquec)/i.test(text)) {
    score += 20;
    evidence.push('thermal equipment');
  }
  if (/(valve|v\b|q\b|register|registo|registro)/i.test(text)) {
    score += 20;
    evidence.push('valve keyword');
  }
  if (/(pump|bomba|compressor|fan|blower)/i.test(text)) {
    score += 20;
    evidence.push('rotating equipment');
  }
  if (/(sensor|transmitter|indicator|gauge|meter|ti|pi|fi|li|tt|pt|ft|lt)/i.test(text)) {
    score += 20;
    evidence.push('instrument keyword');
  }

  return { score, evidence };
}

function deriveTagFromFileName(fileName = '') {
  const clean = fileName.replace(/\.[^.]+$/, '');
  const match = clean.match(/\b([a-z]{1,4})[-_\s]?0*([0-9]{1,4})\b/i);
  if (match) {
    return `${match[1].toUpperCase()}-${String(Number(match[2])).padStart(3, '0')}`;
  }
  return '';
}

export function analyzeFieldPhoto({
  file,
  ocrText = '',
  elements = [],
  selectedElement = null,
  currentFluxogram = null,
}) {
  const fileName = file?.name || 'field-photo';
  const combinedText = [
    fileName,
    ocrText,
    selectedElement?.tag || '',
    selectedElement?.description || '',
    currentFluxogram?.name || '',
  ].join(' ');

  const legendMatch = detectLegendMatch(combinedText);
  const filenameScore = scoreFromFilename(fileName);
  const tagFromFile = deriveTagFromFileName(fileName);
  const candidates = extractTagCandidates(ocrText);
  const tagFromOcr = candidates[0] || '';

  const confidenceBase = (legendMatch.score + filenameScore.score) / 100;
  const hasTag = Boolean(tagFromOcr || tagFromFile);
  const combinedScore = Math.min(0.99, Math.max(0.35, confidenceBase + (hasTag ? 0.18 : 0)));
  const suggestedType = legendMatch.type || 'outro';
  const suggestedTag = tagFromOcr || tagFromFile || buildNextTag({ type: suggestedType, existingElements: elements });
  const matchedElement = findElementByTag(elements, suggestedTag);

  const rationale = [
    legendMatch.reason,
    filenameScore.evidence.length ? `Arquivo indica: ${filenameScore.evidence.join(', ')}` : '',
    tagFromOcr ? `OCR detectou: ${tagFromOcr}` : '',
    selectedElement?.tag ? `Contexto atual: ${selectedElement.tag}` : '',
  ].filter(Boolean);

  return {
    type: suggestedType,
    label: legendMatch.label,
    color: legendMatch.color,
    icon: legendMatch.icon,
    suggestedTag,
    confidence: Math.round(combinedScore * 100),
    rationale,
    keywords: legendMatch.keywords || [],
    ocrText,
    matchedElementId: matchedElement?.id || null,
    matchedElementTag: matchedElement?.tag || null,
    candidates,
  };
}
