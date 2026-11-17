import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

/* ==========================================================================
   Palettes
   ---------
   Colours are described by *role* rather than by raw tag, so each preset can be
   swapped without touching the tag wiring below.

   "Neon" reproduces the saturated, high-contrast look where JSX tags are hot
   pink, attributes are green, attribute values and strings are acid yellow,
   keywords are violet and identifiers are cyan.
   ========================================================================== */

export interface Palette {
  comment: string;
  keyword: string; // module keyword: import, export, from
  control: string; // default, return, if, else, for
  definition: string; // function, const, let, class
  name: string;
  property: string;
  fn: string;
  tag: string; // JSX / HTML element names
  angle: string; // < > </ />
  attribute: string; // JSX / HTML attribute names
  value: string; // attribute values
  string: string;
  number: string;
  atom: string; // true, false, null, flex, block
  type: string;
  selector: string; // CSS class / id selector
  color: string;
  unit: string;
  operator: string;
  punct: string;
  brace: string;
  content: string; // JSX / HTML text nodes
  regexp: string;
  meta: string;
  label: string;
  invalid: string;
}

const classicDark: Palette = {
  comment: "#5f6a89",
  keyword: "#a98bff",
  control: "#a98bff",
  definition: "#c59bff",
  name: "#e4e8f5",
  property: "#8fd3ff",
  fn: "#7ee0ff",
  tag: "#9aa7c9",
  angle: "#9aa7c9",
  attribute: "#8fd3ff",
  value: "#8fe6b8",
  string: "#8fe6b8",
  number: "#ffc78a",
  atom: "#ffc78a",
  type: "#ffc78a",
  selector: "#ffd36b",
  color: "#ffd36b",
  unit: "#ffc78a",
  operator: "#9aa7c9",
  punct: "#9aa7c9",
  brace: "#9aa7c9",
  content: "#dfe5f7",
  regexp: "#ff9ecb",
  meta: "#ffa8a8",
  label: "#ffd36b",
  invalid: "#ff8080",
};

const classicLight: Palette = {
  comment: "#8a91a8",
  keyword: "#6d28d9",
  control: "#6d28d9",
  definition: "#7c3aed",
  name: "#20263a",
  property: "#0369a1",
  fn: "#0e7490",
  tag: "#5b6478",
  angle: "#5b6478",
  attribute: "#0369a1",
  value: "#0f766e",
  string: "#0f766e",
  number: "#b45309",
  atom: "#b45309",
  type: "#b45309",
  selector: "#a16207",
  color: "#b45309",
  unit: "#b45309",
  operator: "#5b6478",
  punct: "#5b6478",
  brace: "#5b6478",
  content: "#1f2537",
  regexp: "#be185d",
  meta: "#b91c1c",
  label: "#a16207",
  invalid: "#dc2626",
};

const neonDark: Palette = {
  comment: "#6b7694",
  keyword: "#ff4fd8",
  control: "#b98cff",
  definition: "#b98cff",
  name: "#f2f4ff",
  property: "#58c8ff",
  fn: "#4fe3ff",
  tag: "#ff3d8b",
  angle: "#ff6fae",
  attribute: "#5cff95",
  value: "#d8ff66",
  string: "#d8ff66",
  number: "#ffb454",
  atom: "#ffb454",
  type: "#ffd166",
  selector: "#ff3d8b",
  color: "#d8ff66",
  unit: "#ffb454",
  operator: "#ff8fc0",
  punct: "#a48bc0",
  brace: "#c9a2e0",
  content: "#f2f4ff",
  regexp: "#ff8fc0",
  meta: "#ff4fd8",
  label: "#ffd166",
  invalid: "#ff5c5c",
};

const neonLight: Palette = {
  comment: "#8b93ad",
  keyword: "#c026d3",
  control: "#7c3aed",
  definition: "#7c3aed",
  name: "#161b2b",
  property: "#0284c7",
  fn: "#0369a1",
  tag: "#db2777",
  angle: "#e0479a",
  attribute: "#047857",
  value: "#4d7c0f",
  string: "#4d7c0f",
  number: "#b45309",
  atom: "#b45309",
  type: "#a16207",
  selector: "#db2777",
  color: "#4d7c0f",
  unit: "#b45309",
  operator: "#be185d",
  punct: "#7b6b91",
  brace: "#7b6b91",
  content: "#161b2b",
  regexp: "#be185d",
  meta: "#c026d3",
  label: "#a16207",
  invalid: "#dc2626",
};

export type SyntaxPreset = "neon" | "classic";

export const paletteFor = (mode: "dark" | "light", preset: SyntaxPreset): Palette => {
  if (preset === "neon") return mode === "dark" ? neonDark : neonLight;
  return mode === "dark" ? classicDark : classicLight;
};

/** Maps semantic roles onto CodeMirror highlight tags. */
export const buildHighlight = (p: Palette) =>
  HighlightStyle.define(tagSpecs(p));

/** Raw tag → colour specs (exported so tests and swatches can inspect them). */
export const tagSpecs = (p: Palette) => [
  { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: "italic" },
  { tag: [t.moduleKeyword], color: p.keyword },
  { tag: [t.controlKeyword], color: p.control },
  { tag: [t.definitionKeyword, t.operatorKeyword, t.modifier, t.keyword], color: p.definition },
  { tag: [t.tagName], color: p.tag },
  { tag: [t.angleBracket], color: p.angle },
  { tag: [t.attributeName], color: p.attribute },
  { tag: [t.attributeValue], color: p.value },
  { tag: [t.definitionOperator], color: p.operator },
  { tag: [t.className, t.typeName], color: p.type },
  { tag: [t.propertyName], color: p.property },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.function(t.definition(t.variableName))], color: p.fn },
  { tag: [t.definition(t.variableName), t.definition(t.propertyName), t.definition(t.name)], color: p.name },
  { tag: [t.variableName, t.name, t.self, t.namespace], color: p.name },
  { tag: [t.string, t.special(t.string), t.inserted, t.character], color: p.string },
  { tag: [t.regexp, t.escape], color: p.regexp },
  { tag: [t.number, t.integer, t.float], color: p.number },
  { tag: [t.atom, t.bool, t.null, t.unit], color: p.atom },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: p.color },
  { tag: [t.labelName, t.changed], color: p.label },
  { tag: [t.operator], color: p.operator },
  { tag: [t.punctuation, t.separator, t.derefOperator], color: p.punct },
  { tag: [t.brace, t.paren, t.squareBracket], color: p.brace },
  { tag: [t.content, t.contentSeparator], color: p.content },
  { tag: [t.meta, t.documentMeta, t.processingInstruction, t.annotation], color: p.meta },
  { tag: [t.heading, t.strong], color: p.tag, fontWeight: "650" },
  { tag: [t.emphasis], color: p.keyword, fontStyle: "italic" },
  { tag: [t.link, t.url], color: p.fn, textDecoration: "underline" },
  { tag: [t.strikethrough], color: p.comment, textDecoration: "line-through" },
  { tag: t.invalid, color: p.invalid },
  
];

/* ==========================================================================
   Editor chrome
   ========================================================================== */

const darkTheme = (accent: string, cursor: string) =>
  EditorView.theme(
    {
      "&": {
        color: "#e4e8f5",
        backgroundColor: "transparent",
        fontSize: "var(--editor-font-size, 13.5px)",
        height: "100%",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.65",
        padding: "10px 0 40vh",
        overflow: "auto",
      },
      ".cm-content": { caretColor: cursor, paddingInline: "4px" },
      ".cm-line": { paddingInline: "12px 18px" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: cursor, borderLeftWidth: "2px" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "rgba(126, 178, 255, 0.22)",
      },
      ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.035)" },
      ".cm-selectionMatch": { backgroundColor: "rgba(126, 242, 208, 0.13)" },
      ".cm-gutters": {
        backgroundColor: "transparent",
        color: "#4b5570",
        border: "none",
        paddingLeft: "4px",
      },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#8b96b5" },
      ".cm-lineNumbers .cm-gutterElement": { minWidth: "26px", fontSize: "11.5px" },
      ".cm-panels": {
        backgroundColor: "#151a29",
        color: "#c9d2e8",
        borderTop: "1px solid #232a3f",
      },
      ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #232a3f" },
      ".cm-panel input, .cm-panel button": {
        fontSize: "12px",
        borderRadius: "8px",
        border: "1px solid #2c3450",
        background: "#0f1420",
        color: "#dbe2f4",
        padding: "4px 8px",
      },
      ".cm-searchMatch": { backgroundColor: "rgba(255, 211, 105, 0.24)" },
      ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "rgba(255, 211, 105, 0.45)" },
      ".cm-tooltip": {
        backgroundColor: "#171d2d",
        border: "1px solid #2a3350",
        borderRadius: "10px",
        overflow: "hidden",
      },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "#28324f",
        color: "#f2f5ff",
      },
      ".cm-foldPlaceholder": { backgroundColor: "#232b42", border: "none", color: "#9fb0d8" },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "rgba(126, 242, 208, 0.18)",
        outline: `1px solid ${accent}`,
      },
      ".cm-placeholder": { color: "#4d5877" },
      ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
      ".cm-scroller::-webkit-scrollbar-thumb": { background: "#2a3350", borderRadius: "99px" },
    },
    { dark: true },
  );

const lightTheme = (accent: string, cursor: string) =>
  EditorView.theme(
    {
      "&": {
        color: "#20263a",
        backgroundColor: "transparent",
        fontSize: "var(--editor-font-size, 13.5px)",
        height: "100%",
      },
      ".cm-scroller": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.65",
        padding: "10px 0 40vh",
        overflow: "auto",
      },
      ".cm-content": { caretColor: cursor, paddingInline: "4px" },
      ".cm-line": { paddingInline: "12px 18px" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: cursor, borderLeftWidth: "2px" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "rgba(91, 91, 214, 0.14)",
      },
      ".cm-activeLine": { backgroundColor: "rgba(20, 30, 60, 0.035)" },
      ".cm-gutters": {
        backgroundColor: "transparent",
        color: "#a4acbf",
        border: "none",
        paddingLeft: "4px",
      },
      ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#5d6478" },
      ".cm-lineNumbers .cm-gutterElement": { minWidth: "26px", fontSize: "11.5px" },
      ".cm-panels": {
        backgroundColor: "#f2f3f9",
        color: "#2b3348",
        borderTop: "1px solid #e2e5f0",
      },
      ".cm-panel input, .cm-panel button": {
        fontSize: "12px",
        borderRadius: "8px",
        border: "1px solid #d8dced",
        background: "#fff",
        color: "#2b3348",
        padding: "4px 8px",
      },
      ".cm-searchMatch": { backgroundColor: "rgba(255, 186, 60, 0.28)" },
      ".cm-tooltip": { backgroundColor: "#fff", border: "1px solid #e1e4f0", borderRadius: "10px" },
      ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "#eef0fb",
        color: "#141a2b",
      },
      ".cm-foldPlaceholder": { backgroundColor: "#eceefa", border: "none", color: "#5d6478" },
      ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
        backgroundColor: "rgba(15, 157, 120, 0.16)",
        outline: `1px solid ${accent}`,
      },
      ".cm-placeholder": { color: "#aab1c2" },
      ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
      ".cm-scroller::-webkit-scrollbar-thumb": { background: "#d6dae8", borderRadius: "99px" },
    },
    { dark: false },
  );

export const editorTheme = (
  mode: "dark" | "light",
  preset: SyntaxPreset = "neon",
): Extension => {
  const neon = preset === "neon";
  const accent = neon ? "rgba(255, 79, 216, 0.4)" : "rgba(126,242,208,.35)";
  const cursor = neon
    ? mode === "dark"
      ? "#4fe3ff"
      : "#0369a1"
    : mode === "dark"
      ? "#7ef2d0"
      : "#0f9d78";

  return [
    mode === "dark" ? darkTheme(accent, cursor) : lightTheme(accent, cursor),
    syntaxHighlighting(buildHighlight(paletteFor(mode, preset))),
  ];
};

/** Exposed for the settings preview swatches. */
export const presetSwatches = (preset: SyntaxPreset, mode: "dark" | "light") => {
  const p = paletteFor(mode, preset);
  return [p.keyword, p.tag, p.attribute, p.value, p.name];
};
