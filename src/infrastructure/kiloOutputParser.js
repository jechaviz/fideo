const stripFence = (value) => {
  const text = String(value || '').trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : text;
};

const jsonObjectCandidate = (value) => {
  const text = stripFence(value);
  const marker = text.match(/FINAL_JSON\s*:?\s*([\s\S]+)$/i);
  const marked = marker ? marker[1].trim() : text;
  const first = marked.indexOf('{');
  const last = marked.lastIndexOf('}');
  return first >= 0 && last > first ? marked.slice(first, last + 1) : marked;
};

const parseCandidate = (value) => {
  try {
    const parsed = JSON.parse(jsonObjectCandidate(value));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const collectEventText = (output) => String(output || '')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    try {
      const event = JSON.parse(line);
      return event?.part?.text || event?.text || '';
    } catch {
      return '';
    }
  })
  .filter(Boolean)
  .join('\n');

export const extractKiloTextOutput = (output) => stripFence(collectEventText(output) || output);

const candidateTexts = (output) => {
  const raw = String(output || '');
  const eventText = collectEventText(raw);
  const texts = [eventText, raw].filter(Boolean);
  const candidates = [];

  texts.forEach((text) => {
    const finalLine = text.split(/\r?\n/).reverse()
      .find((line) => line.includes('FINAL_JSON'));
    if (finalLine) candidates.push(finalLine.replace(/^.*FINAL_JSON\s*:?\s*/i, ''));
    const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    fenced.forEach((match) => candidates.push(match[1]));
    candidates.push(text);
  });

  return candidates;
};

export const parseKiloFinalJson = (output) => {
  for (const candidate of candidateTexts(output)) {
    const parsed = parseCandidate(candidate);
    if (parsed) return parsed;
  }
  return null;
};
