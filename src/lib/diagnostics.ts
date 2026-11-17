import type { Diagnostic } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";

/**
 * Lightweight, browser-side linters. They are intentionally forgiving: Otion is
 * an editor, not a compiler, so these catch the mistakes that actually annoy you
 * mid-type (unclosed tags/brackets, stray CSS, broken JSON) without crying wolf
 * about partial input.
 */

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

interface Span {
  from: number;
  to: number;
}

const lineSpan = (state: EditorState, lineStart: number, length: number): Span => ({
  from: Math.min(lineStart, state.doc.length),
  to: Math.min(lineStart + Math.max(length, 1), state.doc.length),
});

/* --------------------------------- HTML ---------------------------------- */

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr", "!doctype",
]);

const RAW_TAGS = new Set(["script", "style"]);

export function lintHtml(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  const diagnostics: Diagnostic[] = [];
  const stack: { name: string; from: number }[] = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;

  let raw: string | null = null;

  for (const match of text.matchAll(tagPattern)) {
    const [full, slash, rawName, rest] = match;
    const name = rawName.toLowerCase();
    const from = match.index ?? 0;

    if (raw) {
      if (slash && name === raw) raw = null;
      continue;
    }

    if (slash) {
      const last = stack[stack.length - 1];
      if (!last) {
        diagnostics.push({
          ...lineSpan(state, from, full.length),
          severity: "error",
          message: `Stray closing tag </${name}> — nothing is open.`,
        });
      } else if (last.name !== name) {
        diagnostics.push({
          ...lineSpan(state, from, full.length),
          severity: "error",
          message: `</${name}> closes <${last.name}>? Expected </${last.name}>.`,
        });
        // Recover: drop the mismatched opener so one typo isn't reported twice.
        stack.pop();
      } else {
        stack.pop();
      }
      continue;
    }

    if (rest.trimEnd().endsWith("/") || VOID_TAGS.has(name)) continue;
    stack.push({ name, from });
    if (RAW_TAGS.has(name)) raw = name;
  }

  for (const open of stack) {
    diagnostics.push({
      ...lineSpan(state, open.from, open.name.length + 1),
      severity: "warning",
      message: `<${open.name}> is never closed.`,
    });
  }

  // Attribute values must be quoted, and `=` needs a value.
  const attrPattern = /\s([a-zA-Z_:][\w:.-]*)\s*=\s*(?![">])([^\s>]*)/g;
  for (const match of text.matchAll(attrPattern)) {
    if (match[2] === "" || match[2].startsWith(">")) continue;
    if (/^["']/.test(match[2])) continue;
    const from = match.index ?? 0;
    diagnostics.push({
      ...lineSpan(state, from, match[0].length),
      severity: "warning",
      message: `Quote the value of ${match[1]} (e.g. ${match[1]}="${match[2]}").`,
    });
  }

  return diagnostics;
}

/* ---------------------------------- CSS ---------------------------------- */

export function lintCss(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  const diagnostics: Diagnostic[] = [];
  const stack: { char: string; from: number }[] = [];
  let quote: string | null = null;
  let inComment = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inComment) {
      if (char === "*" && text[i + 1] === "/") {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && text[i + 1] === "*") {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "(") stack.push({ char, from: i });
    else if (char === "}" || char === ")") {
      const open = stack.pop();
      const expected = char === "}" ? "{" : "(";
      if (!open || open.char !== expected) {
        diagnostics.push({
          ...lineSpan(state, i, 1),
          severity: "error",
          message: `Unexpected "${char}" — no matching "${expected}".`,
        });
      }
    }
  }

  for (const open of stack) {
    diagnostics.push({
      ...lineSpan(state, open.from, 1),
      severity: "warning",
      message: `"${open.char}" is never closed.`,
    });
  }

  // Declarations missing a colon before the value.
  const declPattern = /^[ \t]*([\w-]+)[ \t]+([^:;{}\n]+);/gm;
  for (const match of text.matchAll(declPattern)) {
    const name = match[1];
    if (["from", "to", "and", "not", "only", "and", "or"].includes(name)) continue;
    const from = (match.index ?? 0) + match[0].indexOf(name);
    diagnostics.push({
      ...lineSpan(state, from, match[0].trim().length),
      severity: "warning",
      message: `Add a colon after "${name}" — did you mean "${name}: ${match[2].trim()};"?`,
    });
  }

  return diagnostics;
}

/* ---------------------------------- JSON --------------------------------- */

export function lintJson(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  if (!text.trim()) return [];
  try {
    JSON.parse(text);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const match = /position (\d+)/.exec(message);
    const position = match ? Math.min(Number(match[1]), text.length) : 0;
    return [
      {
        from: position,
        to: Math.min(position + 1, text.length),
        severity: "error",
        message: `Invalid JSON: ${message}`,
      },
    ];
  }
}

/* ---------------------------------- JS/TS -------------------------------- */

export function lintScript(state: EditorState): Diagnostic[] {
  const text = state.doc.toString();
  const diagnostics: Diagnostic[] = [];
  const stack: { char: string; from: number }[] = [];
  let quote: string | null = null;
  let template = false;
  let inComment = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inComment) {
      if (char === "\n") inComment = false;
      if (char === "*" && text[i + 1] === "/") {
        inComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && text[i + 1] === "/") {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === "/" && text[i + 1] === "*") {
      inComment = true;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      if (char === "`") template = true;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") stack.push({ char, from: i });
    else if (char === "}" || char === ")" || char === "]") {
      const open = stack.pop();
      const pairs: Record<string, string> = { "}": "{", ")": "(", "]": "[" };
      if (!open || open.char !== pairs[char]) {
        diagnostics.push({
          ...lineSpan(state, i, 1),
          severity: "error",
          message: `Unexpected "${char}".`,
        });
      }
    }
  }
  if (template) template = false;

  for (const open of stack) {
    diagnostics.push({
      ...lineSpan(state, open.from, 1),
      severity: "warning",
      message: `"${open.char}" is never closed.`,
    });
  }

  return diagnostics;
}

export function linterForFile(fileName: string) {
  switch (extensionOf(fileName)) {
    case "html":
    case "htm":
    case "svg":
      return lintHtml;
    case "css":
      return lintCss;
    case "json":
      return lintJson;
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
    case "ts":
    case "tsx":
      return lintScript;
    default:
      return null;
  }
}
