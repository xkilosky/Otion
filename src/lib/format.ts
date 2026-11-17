/**
 * A deliberately small, dependency-free formatter. It re-indents brace/bracket
 * languages (JS/TS/JSON/CSS) and normalises whitespace for markup, while leaving
 * the contents of strings and template literals untouched.
 */

const OPENERS = new Set(["{", "(", "["]);
const CLOSERS = new Set(["}", ")", "]"]);
const CLOSER_OF: Record<string, string> = { "}": "{", ")": "(", "]": "[" };

interface Scan {
  delta: number;
  startsWithCloser: boolean;
  openerStack: string[];
}

/** Scans one line, ignoring anything inside quotes or line comments. */
function scanLine(line: string, initialQuote: string | null): { scan: Scan; endQuote: string | null } {
  let quote = initialQuote;
  let delta = 0;
  let firstMeaningful: string | null = null;
  const openerStack: string[] = [];

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (quote) {
      if (char === "\\") {
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && line[i + 1] === "/") break;

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      if (firstMeaningful === null) firstMeaningful = char;
      continue;
    }

    if (!char.trim()) continue;
    if (firstMeaningful === null) firstMeaningful = char;

    if (OPENERS.has(char)) {
      delta += 1;
      openerStack.push(char);
    } else if (CLOSERS.has(char)) {
      delta -= 1;
      openerStack.pop();
    }
  }

  return {
    scan: {
      delta,
      startsWithCloser: firstMeaningful !== null && CLOSERS.has(firstMeaningful),
      openerStack,
    },
    endQuote: quote,
  };
}

export function formatBraces(source: string, indent = "  "): string {
  const lines = source.split("\n");
  let depth = 0;
  let carryQuote: string | null = null;
  const out: string[] = [];

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    // Continuation of a multi-line string/template literal: keep verbatim.
    if (carryQuote) {
      out.push(raw.replace(/\s+$/, ""));
      const { endQuote } = scanLine(line, carryQuote);
      if (!endQuote) continue;
      carryQuote = null;
      continue;
    }

    if (!line.trim()) {
      out.push("");
      continue;
    }

    const { scan, endQuote } = scanLine(line, null);
    if (endQuote) carryQuote = endQuote;

    if (scan.startsWithCloser) depth = Math.max(0, depth - 1);
    out.push(indent.repeat(depth) + line.trim());

    if (scan.startsWithCloser) {
      // The closing token was already discounted from the opening depth.
      depth = Math.max(0, depth + scan.delta + 1);
    } else {
      depth = Math.max(0, depth + scan.delta);
    }
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
}

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const RAW_TAGS = new Set(["script", "style", "pre", "textarea"]);

/** Tracks whether a line ends inside a tag or an HTML comment. */
function endsInsideTag(line: string) {
  let inTag = false;
  let inComment = false;
  let quote: string | null = null;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inComment) {
      if (char === "-" && line[i + 1] === "-" && line[i + 2] === ">") {
        inComment = false;
        i += 2;
      }
      continue;
    }

    if (quote) {
      if (char === quote) quote = null;
      continue;
    }

    if (!inTag && char === "<" && line[i + 1] === "!" && line[i + 2] === "-" && line[i + 3] === "-") {
      inComment = true;
      i += 3;
      continue;
    }

    if (!inTag && char === "<") {
      inTag = true;
      continue;
    }

    if (inTag && (char === '"' || char === "'")) {
      quote = char;
      continue;
    }

    if (inTag && char === ">") {
      inTag = false;
    }
  }

  return inTag || inComment;
}

const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)>/g;

interface LineScan {
  opens: string[];
  closes: string[];
  rawOpened: string | null;
  rawClosed: boolean;
}

function scanTags(line: string): LineScan {
  const opens: string[] = [];
  const closes: string[] = [];
  let rawOpened: string | null = null;
  let rawClosed = false;

  for (const match of line.matchAll(tagPattern)) {
    const [, slash, rawName, rest] = match;
    const name = rawName.toLowerCase();

    if (slash) {
      closes.push(name);
      if (RAW_TAGS.has(name)) rawClosed = true;
      continue;
    }

    if (rest.trimEnd().endsWith("/") || VOID_TAGS.has(name)) continue;
    opens.push(name);
    if (RAW_TAGS.has(name)) rawOpened = name;
  }

  return { opens, closes, rawOpened, rawClosed };
}

/**
 * Re-indents markup by tag nesting. Lines inside a multi-line tag keep their own
 * indentation, and the contents of `<script>`, `<style>`, `<pre>` and
 * `<textarea>` are never touched.
 */
export function formatMarkup(source: string, indent = "  "): string {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let depth = 0;
  let continuation = false;
  let rawTag: string | null = null;

  for (const raw of lines) {
    const trimmed = raw.trim();
    const line = raw.replace(/\s+$/, "");

    if (!trimmed) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }

    // Inside <script>/<style>/<pre>: keep the author's text verbatim, but align
    // the closing tag with the element that opened it.
    if (rawTag) {
      if (trimmed.toLowerCase().startsWith(`</${rawTag}`)) {
        depth = Math.max(0, depth - 1);
        out.push(indent.repeat(depth) + trimmed);
        rawTag = null;
      } else {
        out.push(line);
      }
      continue;
    }

    // Inside a tag that spans lines: don't re-indent, just trim.
    if (continuation) {
      out.push(line);
      if (!endsInsideTag(trimmed)) continuation = false;
      continue;
    }

    const scan = scanTags(line);
    const startsWithClose = /^<\//.test(trimmed);

    if (startsWithClose) depth = Math.max(0, depth - 1);
    out.push(indent.repeat(depth) + trimmed);

    depth = Math.max(0, depth + scan.opens.length - scan.closes.length + (startsWithClose ? 1 : 0));

    if (scan.rawOpened && !scan.rawClosed) {
      rawTag = scan.rawOpened;
    } else if (endsInsideTag(trimmed)) {
      continuation = true;
    }
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+/, "")
    .replace(/\s+$/, "");
}

export function formatCode(source: string, fileName: string): string {
  const normalized = source.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
  if (/\.(html?|xml|svg|vue|md|markdown|txt)$/i.test(fileName)) {
    return formatMarkup(normalized);
  }
  return formatBraces(normalized);
}

export const formatKind = (fileName: string) => {
  if (/\.(html?|xml|svg|vue)$/i.test(fileName)) return "indent tags";
  if (/\.(css|scss|less|js|mjs|cjs|jsx|ts|tsx|json)$/i.test(fileName)) return "re-indent";
  return "tidy whitespace";
};

export { CLOSER_OF };
