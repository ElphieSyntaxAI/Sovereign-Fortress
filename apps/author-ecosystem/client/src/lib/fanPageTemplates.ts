export type FanPageTemplate = {
  id: string;
  name: string;
  description: string;
  defaultTheme: { primary: string; accent: string; background: string };
};

export const FAN_PAGE_TEMPLATES: FanPageTemplate[] = [
  {
    id: "aurora",
    name: "Aurora",
    description: "Violet horizon with amber highlights — default Lore-Gate look.",
    defaultTheme: { primary: "#8b5cf6", accent: "#f59e0b", background: "#0a0612" },
  },
  {
    id: "chronicle",
    name: "Chronicle",
    description: "Parchment dark with copper accents — classic fantasy chronicle.",
    defaultTheme: { primary: "#b45309", accent: "#fcd34d", background: "#1c1410" },
  },
  {
    id: "nebula",
    name: "Nebula",
    description: "Deep space blues with cyan fan-art frames.",
    defaultTheme: { primary: "#0ea5e9", accent: "#22d3ee", background: "#030712" },
  },
  {
    id: "grove",
    name: "Grove",
    description: "Forest greens with soft moss panels for polls and quizzes.",
    defaultTheme: { primary: "#16a34a", accent: "#86efac", background: "#052e16" },
  },
  {
    id: "ember",
    name: "Ember",
    description: "High-contrast ember red for action-forward fandoms.",
    defaultTheme: { primary: "#dc2626", accent: "#fb923c", background: "#1a0505" },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean monochrome — fan art and mail take center stage.",
    defaultTheme: { primary: "#e4e4e7", accent: "#a1a1aa", background: "#09090b" },
  },
];

export function templateById(id: string): FanPageTemplate {
  return FAN_PAGE_TEMPLATES.find((t) => t.id === id) ?? FAN_PAGE_TEMPLATES[0];
}
