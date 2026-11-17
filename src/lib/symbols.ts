import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Symbol outline + breadcrumb trail. Uses the real syntax tree when a grammar is
 * available (so top-level declarations win), and falls back to a regex sweep for
 * plain text, CSS selectors and HTML ids.
 */

export type SymbolKind =
  | "function"
  | "class"
  | "const"
  | "variable"
  | "selector"
  | "tag"
  | "heading"
  | "property"
  | "section";

export interface SymbolEntry {
  name: string;
  detail: string;
  kind: SymbolKind;
  line: number; // 1-based
  from: number;
  to: number;
}

const ICONS: Record<SymbolKind, string> = {
  function: "ƒ",
  class: "◇",
  const: "const",
  variable: "var",
  selector: "{}",
  tag: "<>",
  heading: "H",
  property: "·",
  section: "§",
};

export const symbolIcon = (kind: SymbolKind) => ICONS[kind];

const VOID_TAGS = new Set([
  "br", "hr", "img", "input", "link", "meta", "source", "area", "base", "col",
  "embed", "param", "track", "wbr", "path", "circle", "rect", "line", "use",
]);

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

function fromTree(state: EditorState): SymbolEntry[] {
  const entries: SymbolEntry[] = [];
  const seen = new Set<string>();
  const tree = syntaxTree(state);

  tree.iterate({
    enter: (node) => {
      const name = node.name;
      let kind: SymbolKind | null = null;
      let detail = "";
      let labelNode = null as typeof node | null;

      if (name === "FunctionDeclaration") {
        kind = "function";
        detail = "function";
      } else if (name === "ClassDeclaration") {
        kind = "class";
        detail = "class";
      } else if (name === "VariableDeclaration") {
        const text = state.sliceDoc(node.from, Math.min(node.to, node.from + 40));
        if (/^\s*(const|let|var)\s/.test(text)) {
          kind = "const";
          detail = /^const/.test(text.trim()) ? "const" : "let";
        }
      } else if (name === "Heading" || name === "ATXHeading1" || name === "SetextHeading") {
        kind = "heading";
        detail = "heading";
      }

      if (!kind) return;

      // Find the identifier to display.
      tree.iterate({
        from: node.from,
        to: node.to,
        enter: (child) => {
          if (
            !labelNode &&
            (child.name === "VariableDefinition" ||
              child.name === "VariableName" ||
              child.name === "TypeName" ||
              child.name === "PropertyName")
          ) {
            labelNode = child;
            return false;
          }
          return undefined;
        },
      });

      const label = labelNode
        ? state.sliceDoc(labelNode.from, labelNode.to)
        : state.sliceDoc(node.from, Math.min(node.to, node.from + 24)).split("\n")[0];

      if (!label || seen.has(label)) return;
      seen.add(label);

      const line = state.doc.lineAt(node.from);
      entries.push({
        name: label.replace(/\s+/g, " ").slice(0, 60),
        detail,
        kind,
        line: line.number,
        from: node.from,
        to: node.to,
      });
      return undefined;
    },
  });

  return entries;
}

function fromRegex(state: EditorState, fileName: string): SymbolEntry[] {
  const ext = extensionOf(fileName);
  const entries: SymbolEntry[] = [];
  const push = (name: string, kind: SymbolKind, line: number, from: number, detail = "") => {
    entries.push({ name: name.slice(0, 70), detail, kind, line, from, to: from });
  };

  const seenNames = new Set<string>();
  const lines = state.doc.toString().split("\n");
  lines.forEach((text, index) => {
    if (ext === "css") {
      const selector = /^\s*([^@{}/][^{}]*?)\s*\{/.exec(text);
      if (selector) push(selector[1].trim(), "selector", index + 1, 0, "rule");
      return;
    }
    if (ext === "html" || ext === "htm") {
      // A tag is worth listing when it opens a block: structural tags, anything
      // with an id/class, or any h1–h6 — nested ones included so the tree shows depth.
      const matches = text.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>/g);
      for (const match of matches) {
        const [, slash, rawName, rest] = match;
        const tag = rawName.toLowerCase();
        if (slash || VOID_TAGS.has(tag) || rest.trimEnd().endsWith("/")) continue;
        const id = /\sid=["']([^"']+)["']/.exec(rest)?.[1];
        const className = /\sclass=["']([^"']+)["']/.exec(rest)?.[1]?.split(/\s+/)[0];
        const isStructural = ["main", "section", "article", "header", "footer", "nav", "aside", "h1", "h2", "h3", "h4", "h5", "h6", "form", "table", "ul", "ol", "canvas", "dialog", "template"].includes(tag);
        if (!isStructural && !id && !className) continue;
        const label = id ? `#${id}` : className ? `.${className}` : tag;
        if (seenNames.has(label)) continue;
        seenNames.add(label);
        push(label, "tag", index + 1, match.index ?? 0, className || id ? `<${tag}>` : "element");
      }
      return;
    }
    if (ext === "md") {
      const heading = /^(#{1,6})\s+(.*)$/.exec(text);
      if (heading) push(heading[2], "heading", index + 1, 0, `h${heading[1].length}`);
      return;
    }
    if (["js", "mjs", "jsx", "ts", "tsx"].includes(ext)) {
      const fn = /^\s*(?:export\s+)?(?:async\s+)?function\s+([\w$]+)/.exec(text);
      if (fn) return push(fn[1], "function", index + 1, 0, "function");
      const klass = /^\s*(?:export\s+)?class\s+([\w$]+)/.exec(text);
      if (klass) return push(klass[1], "class", index + 1, 0, "class");
      const variable = /^\s*(?:export\s+)?(const|let|var)\s+([\w${}]+)/.exec(text);
      if (variable) push(variable[2], "const", index + 1, 0, variable[1]);
    }
  });

  return entries;
}

export function collectSymbols(state: EditorState, fileName: string): SymbolEntry[] {
  const treeEntries = ["js", "mjs", "jsx", "ts", "tsx", "md", "markdown"].includes(
    extensionOf(fileName),
  )
    ? fromTree(state)
    : [];
  const found = treeEntries.length ? treeEntries : fromRegex(state, fileName);

  // Sort by position, de-duplicate by line + name.
  const seen = new Set<string>();
  return found
    .sort((a, b) => a.from - b.from || a.line - b.line)
    .filter((entry) => {
      const key = `${entry.line}:${entry.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 200);
}

/** Nearest enclosing heading/section for the breadcrumb trail. */
export function breadcrumbFor(state: EditorState, position: number, fileName: string) {
  const symbols = collectSymbols(state, fileName);
  const ext = extensionOf(fileName);
  const isMarkup = ["html", "htm", "svg"].includes(ext);

  if (isMarkup) {
    const before = state.sliceDoc(0, position);
    const stack: { tag: string; at: number; id?: string }[] = [];
    const pattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;
    for (const match of before.matchAll(pattern)) {
      const [, slash, rawName, rest] = match;
      const name = rawName.toLowerCase();
      if (["br", "img", "input", "link", "meta", "hr", "source", "area", "base", "col", "embed", "param", "track", "wbr"].includes(name)) continue;
      if (rest.trimEnd().endsWith("/")) continue;
      if (slash) stack.pop();
      else stack.push({ tag: name, at: match.index ?? 0, id: /\sid=["']([^"']+)["']/.exec(rest)?.[1] });
    }
    const idForInnermost = stack[stack.length - 1]?.id;
    return [...stack.slice(-3).map((entry) => `<${entry.tag}>`), ...(idForInnermost ? [`#${idForInnermost}`] : [])];
  }

  const line = state.doc.lineAt(position).number;
  const trail = symbols
    .filter((entry) => entry.line <= line)
    .slice(-2)
    .map((entry) => entry.name);
  return trail.length ? trail : [fileName];
}
