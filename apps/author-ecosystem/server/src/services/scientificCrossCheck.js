const { generateBullets } = require("./geminiClient");

/** Heuristic: question likely needs real-world science grounding. */
const RW_REGEXES = [
  /\b(meter|metre|meters|metres|kilometer|kilometre|km\b|cm\b|mm\b|miles?|feet|foot|ft\b|inch|inches|yards?|parsec|AU\b|light[-\s]?years?|nanometer)\b/i,
  /\b(distance|how far|how long|travel time|orbital|radius|diameter|circumference|volume|mass|weight|density)\b/i,
  /\b(gravity|g-force|accelerat|velocity|momentum|force|newton|joule|watt|pressure|atmosphere|vacuum|orbit|escape velocity)\b/i,
  /\b(physics|thermo|entropy|quantum|relativity|electromagnet|electric charge|photon|nuclear|radiation|magnetic field)\b/i,
  /\b(chemistry|molecule|atom|chemical reaction|acid|base|\bpH\b|oxid|bond|catalyst|enzyme|combust|solvent|isotope)\b/i,
  /\b(biology|DNA|RNA|cell|protein|species|evolution|photosynth|ecosystem|organ|tissue|virus|bacteria|genome|enzyme)\b/i,
  /\b(boiling point|melting point|freezing|temperature|celsius|fahrenheit|kelvin|heat capacity)\b/i,
  /\b(structure|collapse|support|load[-\s]?bearing|material strength|tensile|compressive)\b/i,
];

function detectScientificCrossCheckQuestion(question) {
  const q = String(question || "").trim();
  if (q.length < 8) return false;
  return RW_REGEXES.some((re) => re.test(q));
}

/**
 * Scientific Logic tool: second Gemini pass — established real-world science only.
 * @param {{ question: string, canonExcerpt: string }} opts
 */
async function runScientificLogicTool(opts) {
  const { question, canonExcerpt } = opts;
  const system = [
    "You are the Scientific Logic tool for an author HUD.",
    "Use only established real-world science (physics, chemistry, biology, materials, distances, medicine where mainstream).",
    "Output 2 to 6 lines. Each line MUST start with exactly: REAL-WORLD FACT:",
    "Do not invent story canon, character names, or fictional laws. If the question is not about real-world science, output exactly one line: REAL-WORLD FACT: Not applicable.",
    "If the optional canon excerpt describes impossible structures (e.g. floating mountains with no support), still state the real-world rule plainly without adopting the fiction as physical truth.",
  ].join("\n");

  const user = [
    "User question:",
    String(question),
    "",
    "Optional excerpt from the author's uploaded lore (for contradiction checks only; not scientifically authoritative):",
    String(canonExcerpt || "").slice(0, 3500) || "(none)",
  ].join("\n");

  return generateBullets({ system, user });
}

module.exports = {
  detectScientificCrossCheckQuestion,
  runScientificLogicTool,
};
