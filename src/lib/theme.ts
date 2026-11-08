export type ThemeMode = "dark" | "light";

export const MODES: Array<{ id: ThemeMode; label: string; icon: string }> = [
  { id: "dark", label: "Escuro", icon: "\u{1F319}" },
  { id: "light", label: "Claro", icon: "\u{2600}" },
];

export const ACCENTS = [
  { id: "gold", label: "Dourado", hex: "#d4a24e" },
  { id: "azul", label: "Azul", hex: "#4f8fd6" },
  { id: "verde", label: "Verde", hex: "#3aa876" },
  { id: "roxo", label: "Roxo", hex: "#8b6fd6" },
  { id: "rosa", label: "Rosa", hex: "#d9629b" },
  { id: "vermelho", label: "Vermelho", hex: "#d9534f" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export type ThemePref = { mode: ThemeMode; accent: AccentId };
export const THEME_KEY = "crm.tema.v1";
export const DEFAULT_THEME: ThemePref = { mode: "dark", accent: "gold" };

export function accentHex(accent: AccentId): string {
  return ACCENTS.find((a) => a.id === accent)?.hex ?? ACCENTS[0].hex;
}

export function normalizeTheme(raw: unknown): ThemePref {
  const value = (raw ?? {}) as Partial<Record<keyof ThemePref, unknown>>;
  const mode: ThemeMode = value.mode === "light" || value.mode === "dark" ? value.mode : DEFAULT_THEME.mode;
  const accent = ACCENTS.find((a) => a.id === value.accent)?.id ?? DEFAULT_THEME.accent;
  return { mode, accent };
}

export function readTheme(): ThemePref {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return normalizeTheme(JSON.parse(window.localStorage.getItem(THEME_KEY) ?? "null"));
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(pref: ThemePref): void {
  try {
    window.localStorage.setItem(THEME_KEY, JSON.stringify(pref));
  } catch {}
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", pref.mode);
  root.setAttribute("data-accent", pref.accent);
}

export function bootstrapScript(): string {
  const accents = JSON.stringify(ACCENTS.map((a) => a.id));
  return [
    "(function(){try{",
    `var s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)})||"null")||{};`,
    `var m=(s.mode==="light"||s.mode==="dark")?s.mode:${JSON.stringify(DEFAULT_THEME.mode)};`,
    `var a=${accents}.indexOf(s.accent)>=0?s.accent:${JSON.stringify(DEFAULT_THEME.accent)};`,
    "var r=document.documentElement;",
    'r.setAttribute("data-theme",m);r.setAttribute("data-accent",a);',
    "}catch(e){}})();",
  ].join("");
}

export function chartColors(pref: ThemePref) {
  const light = pref.mode === "light";
  return {
    accent: accentHex(pref.accent),
    grid: light ? "#e4e4e7" : "#27272a",
    axis: light ? "#a1a1aa" : "#52525b",
    tick: light ? "#5a5a62" : "#71717a",
    bar: light ? "#d4d4d8" : "#3f3f46",
    tooltipBg: light ? "#ffffff" : "#18181b",
    tooltipBorder: light ? "#e4e4e7" : "#27272a",
    tooltipText: light ? "#101012" : "#fafafa",
  };
}