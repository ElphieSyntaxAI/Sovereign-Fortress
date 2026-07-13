export function parseJsonStripFences(text: string): unknown {
  let s = String(text || "").trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)```/im);
  if (m) s = m[1].trim();
  return JSON.parse(s) as unknown;
}
