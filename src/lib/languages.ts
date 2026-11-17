import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

export function languageForFile(name: string): Extension {
  switch (extensionOf(name)) {
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "html":
    case "htm":
    case "vue":
    case "svg":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    default:
      return [];
  }
}

/**
 * Heavier grammars are fetched on demand so the first paint on a phone stays
 * small. Returns an empty extension until the chunk resolves.
 */
export async function lazyLanguageForFile(name: string): Promise<Extension> {
  switch (extensionOf(name)) {
    case "md":
    case "markdown": {
      const { markdown } = await import("@codemirror/lang-markdown");
      return markdown();
    }
    case "py": {
      const { python } = await import("@codemirror/lang-python");
      return python();
    }
    default:
      return [];
  }
}

export type FileKind = "html" | "css" | "js" | "json" | "md" | "text";

export function kindOf(name: string): FileKind {
  switch (extensionOf(name)) {
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "js":
    case "mjs":
    case "jsx":
    case "ts":
    case "tsx":
      return "js";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "md";
    default:
      return "text";
  }
}

export const fileBadge = (name: string) => {
  switch (kindOf(name)) {
    case "html":
      return "HTML";
    case "css":
      return "CSS";
    case "js":
      return "JS";
    case "json":
      return "JSON";
    case "md":
      return "MD";
    default:
      return "TXT";
  }
};

/** Snippet inserted by the symbol keypad. `cursor` marks final caret offset. */
export interface Snippet {
  label: string;
  insert: string;
  hint?: string;
}

export const KEYPAD_SYMBOLS: Snippet[] = [
  { label: "<", insert: "<" },
  { label: ">", insert: ">" },
  { label: "/", insert: "/" },
  { label: "=", insert: "=" },
  { label: '"', insert: '"' },
  { label: "'", insert: "'" },
  { label: "`", insert: "`" },
  { label: "{", insert: "{" },
  { label: "}", insert: "}" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
  { label: "[", insert: "[" },
  { label: "]", insert: "]" },
  { label: ";", insert: ";" },
  { label: ":", insert: ":" },
  { label: "$", insert: "$" },
  { label: "&", insert: "&" },
  { label: "|", insert: "|" },
  { label: "*", insert: "*" },
  { label: "+", insert: "+" },
  { label: "-", insert: "-" },
  { label: "#", insert: "#" },
  { label: "%", insert: "%" },
  { label: "!", insert: "!" },
  { label: ",", insert: "," },
  { label: ".", insert: "." },
  { label: "_", insert: "_" },
  { label: "←", insert: "__LEFT__", hint: "Move cursor left" },
  { label: "→", insert: "__RIGHT__", hint: "Move cursor right" },
];

export const KEYPAD_LINES: Snippet[] = [
  { label: "</>", insert: "<div></div>", hint: "Div" },
  { label: "() => {}", insert: "() => {\n  \n}", hint: "Arrow fn" },
  { label: "class", insert: 'class {\n  \n}', hint: "Class" },
  { label: "import", insert: 'import {} from "";', hint: "Import" },
  { label: "console", insert: 'console.log();', hint: "Log" },
  { label: "flex", insert: "display: flex;\n", hint: "Flexbox" },
  { label: "grid", insert: "display: grid;\n", hint: "Grid" },
  { label: "@media", insert: "@media (max-width: 600px) {\n  \n}", hint: "Media query" },
  { label: "var(--x)", insert: "var(--)", hint: "CSS var" },
  { label: "→", insert: "__TAB__", hint: "Indent" },
];
