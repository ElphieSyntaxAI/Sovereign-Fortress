function normalizeText(s) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkByChars(text, { chunkSize = 1800, overlap = 200 } = {}) {
  const t = normalizeText(text);
  if (!t) return [];

  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkSize);
    const slice = t.slice(i, end);
    chunks.push(slice);
    if (end >= t.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

module.exports = {
  normalizeText,
  chunkByChars,
};

