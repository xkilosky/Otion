import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";

const darkTheme = EditorView.theme(
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
    ".cm-content": { caretColor: "#7ef2d0", paddingInline: "4px" },
    ".cm-line": { paddingInline: "12px 18px" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#7ef2d0", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "rgba(126, 178, 255, 0.22)" },
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
    ".cm-foldPlaceholder": {
      backgroundColor: "#232b42",
      border: "none",
      color: "#9fb0d8",
    },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(126, 242, 208, 0.18)",
      outline: "1px solid rgba(126,242,208,.35)",
    },
    ".cm-placeholder": { color: "#4d5877" },
    ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "#2a3350",
      borderRadius: "99px",
    },
  },
  { dark: true },
);

const lightTheme = EditorView.theme(
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
    ".cm-content": { caretColor: "#0f9d78", paddingInline: "4px" },
    ".cm-line": { paddingInline: "12px 18px" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0f9d78", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "rgba(91, 91, 214, 0.14)" },
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
    ".cm-tooltip": {
      backgroundColor: "#fff",
      border: "1px solid #e1e4f0",
      borderRadius: "10px",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "#eef0fb",
      color: "#141a2b",
    },
    ".cm-foldPlaceholder": { backgroundColor: "#eceefa", border: "none", color: "#5d6478" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(15, 157, 120, 0.16)",
      outline: "1px solid rgba(15,157,120,.3)",
    },
    ".cm-placeholder": { color: "#aab1c2" },
    ".cm-scroller::-webkit-scrollbar": { width: "8px", height: "8px" },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      background: "#d6dae8",
      borderRadius: "99px",
    },
  },
  { dark: false },
);

const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#5f6a89", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#c59bff" },
  { tag: [t.controlKeyword, t.moduleKeyword], color: "#a98bff" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#e4e8f5" },
  { tag: [t.propertyName], color: "#8fd3ff" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7ee0ff" },
  { tag: [t.labelName], color: "#ffd36b" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#ffd36b" },
  { tag: [t.definition(t.name), t.separator], color: "#f0f3ff" },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.self, t.namespace],
    color: "#ffc78a" },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket, t.tagName],
    color: "#9aa7c9" },
  { tag: [t.string, t.special(t.string), t.inserted], color: "#8fe6b8" },
  { tag: [t.regexp, t.escape], color: "#ff9ecb" },
  { tag: [t.meta, t.documentMeta, t.processingInstruction], color: "#ffa8a8" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#ffc78a" },
  { tag: [t.variableName], color: "#dfe5f7" },
  { tag: [t.heading, t.strong], color: "#9fc7ff", fontWeight: "650" },
  { tag: [t.emphasis], color: "#a9c1ff", fontStyle: "italic" },
  { tag: [t.link, t.url], color: "#83d9ff", textDecoration: "underline" },
  { tag: t.invalid, color: "#ff8080" },
]);

const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: "#8a91a8", fontStyle: "italic" },
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#7c3aed" },
  { tag: [t.controlKeyword, t.moduleKeyword], color: "#6d28d9" },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: "#20263a" },
  { tag: [t.propertyName], color: "#0369a1" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#0e7490" },
  { tag: [t.labelName], color: "#a16207" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#b45309" },
  { tag: [t.definition(t.name), t.separator], color: "#111827" },
  { tag: [t.typeName, t.className, t.number, t.changed, t.annotation, t.self, t.namespace],
    color: "#b45309" },
  { tag: [t.operator, t.punctuation, t.bracket, t.angleBracket, t.tagName],
    color: "#5b6478" },
  { tag: [t.string, t.special(t.string), t.inserted], color: "#0f766e" },
  { tag: [t.regexp, t.escape], color: "#be185d" },
  { tag: [t.meta, t.documentMeta, t.processingInstruction], color: "#b91c1c" },
  { tag: [t.atom, t.bool, t.special(t.variableName)], color: "#b45309" },
  { tag: [t.variableName], color: "#1f2537" },
  { tag: [t.heading, t.strong], color: "#1d4ed8", fontWeight: "650" },
  { tag: [t.emphasis], color: "#3b4a7a", fontStyle: "italic" },
  { tag: [t.link, t.url], color: "#0369a1", textDecoration: "underline" },
  { tag: t.invalid, color: "#dc2626" },
]);

export const editorTheme = (mode: "dark" | "light"): Extension => [
  mode === "dark" ? darkTheme : lightTheme,
  syntaxHighlighting(mode === "dark" ? darkHighlight : lightHighlight),
];
