/**
 * A compact Emmet-style HTML expander.
 *
 * Supports: `div` · `ul>li*3` · `li.item` · `a#id` · `p{text}` · `span{$}*2`
 * · sibling `+` · climb-up `^` · attributes `input[type=text]`.
 * Unknown tags pass through unchanged, so `Tab` never mangles normal text.
 */

interface Node {
  tag: string;
  id?: string;
  classes: string[];
  attrs: { name: string; value: string | null }[];
  text?: string;
  children: Node[];
  repeat: number;
}

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const KNOWN = new Set([
  "a", "abbr", "article", "aside", "audio", "b", "blockquote", "body", "br",
  "button", "canvas", "code", "dd", "details", "dialog", "div", "dl", "dt", "em",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "head", "header", "hr", "html", "i", "iframe", "img", "input",
  "label", "li", "link", "main", "meta", "nav", "ol", "option", "p", "picture",
  "pre", "progress", "section", "select", "small", "source", "span", "strong",
  "style", "summary", "svg", "table", "tbody", "td", "textarea", "th", "thead",
  "title", "tr", "ul", "video", "script",
]);

const isVoid = (tag: string) => VOID.has(tag.toLowerCase());

/** Attributes Emmet adds for a bare tag, so the snippet is immediately useful. */
const IMPLIED_ATTRS: Record<string, [string, string]> = {
  a: ["href", ""],
  form: ["action", ""],
  button: ["type", "button"],
  input: ["type", "text"],
  img: ["src", ""],
  link: ["rel", "stylesheet"],
  script: ["src", ""],
  iframe: ["src", ""],
  video: ["src", ""],
  audio: ["src", ""],
  textarea: ["name", ""],
  select: ["name", ""],
  option: ["value", ""],
  label: ["for", ""],
  meta: ["name", ""],
  source: ["src", ""],
  td: ["colspan", "1"],
};

function parseAbbreviation(source: string): Node | null {
  let index = 0;

  const parseTag = (): Node | null => {
    const start = index;
    let tag = "";
    while (index < source.length && /[a-zA-Z0-9:-]/.test(source[index])) {
      tag += source[index];
      index += 1;
    }
    if (!tag) tag = "div";
    if (!KNOWN.has(tag.toLowerCase()) && !tag.includes("-")) return null;

    const node: Node = { tag, classes: [], attrs: [], children: [], repeat: 1 };

    while (index < source.length) {
      const char = source[index];
      if (char === ".") {
        index += 1;
        let name = "";
        while (index < source.length && /[\w-]/.test(source[index])) {
          name += source[index];
          index += 1;
        }
        if (name) node.classes.push(name);
      } else if (char === "#") {
        index += 1;
        let id = "";
        while (index < source.length && /[\w-]/.test(source[index])) {
          id += source[index];
          index += 1;
        }
        if (id) node.id = id;
      } else if (char === "[") {
        index += 1;
        let inner = "";
        while (index < source.length && source[index] !== "]") {
          inner += source[index];
          index += 1;
        }
        index += 1;
        for (const pair of inner.split(/\s+/).filter(Boolean)) {
          const [name, value] = pair.split("=");
          node.attrs.push({ name, value: value ?? null });
        }
      } else if (char === "{") {
        index += 1;
        let text = "";
        while (index < source.length && source[index] !== "}") {
          text += source[index];
          index += 1;
        }
        index += 1;
        node.text = text;
      } else if (char === "*") {
        index += 1;
        let digits = "";
        while (index < source.length && /\d/.test(source[index])) {
          digits += source[index];
          index += 1;
        }
        node.repeat = Math.min(Math.max(Number(digits) || 1, 1), 50);
      } else {
        break;
      }
    }

    if (index === start && tag === "div" && source[index] === undefined) return null;
    return node;
  };

  const roots: Node[] = [];
  const first = parseTag();
  if (!first) return null;
  roots.push(first);
  let stack: Node[] = [first];

  while (index < source.length) {
    let climbs = 0;
    while (source[index] === "^") {
      climbs += 1;
      index += 1;
    }
    for (let i = 0; i < climbs; i += 1) {
      if (stack.length > 1) stack.pop();
    }

    let op: ">" | "+" | null = null;
    if (source[index] === ">") {
      op = ">";
      index += 1;
    } else if (source[index] === "+") {
      op = "+";
      index += 1;
    } else if (climbs > 0) {
      op = "+";
    } else {
      return null;
    }

    const next = parseTag();
    if (!next) return null;

    if (op === ">") {
      stack[stack.length - 1].children.push(next);
      stack = [...stack, next];
    } else {
      const parent = stack.length > 1 ? stack[stack.length - 2] : null;
      if (parent) parent.children.push(next);
      else roots.push(next);
      stack = parent ? [...stack.slice(0, -1), next] : [next];
    }
  }

  if (roots.length === 1) return roots[0];
  const wrapper: Node = { tag: "", classes: [], attrs: [], children: roots, repeat: 1 };
  return wrapper;
}

function render(node: Node, indent: string, counters: number[]): string {
  const out: string[] = [];
  for (let copy = 0; copy < node.repeat; copy += 1) {
    const attributes: string[] = [];
    if (node.id) attributes.push(`id="${node.id}"`);
    if (node.classes.length) {
      attributes.push(
        `class="${node.classes.join(" ").replace(/\$/g, String(copy + 1))}"`,
      );
    }
    for (const attr of node.attrs) {
      const value = attr.value?.replace(/\$/g, String(copy + 1));
      attributes.push(value === undefined || value === null ? attr.name : `${attr.name}="${value}"`);
    }
    const implied = IMPLIED_ATTRS[node.tag.toLowerCase()];
    if (implied && !node.attrs.some((attr) => attr.name === implied[0]) && !attributes.some((attr) => attr.startsWith(`${implied[0]}=`))) {
      attributes.push(`${implied[0]}="${implied[1]}"`);
    }
    const attrText = attributes.length ? ` ${attributes.join(" ")}` : "";
    const tag = node.tag;
    if (!tag) {
      // Wrapper for `a^b` siblings: render each root at this indent.
      for (const root of node.children) out.push(render(root, indent, counters));
      continue;
    }
    const text = node.text?.replace(/\$/g, String(copy + 1));

    if (isVoid(tag)) {
      out.push(`${indent}<${tag}${attrText} />`);
      continue;
    }
    if (!node.children.length && text === undefined) {
      out.push(`${indent}<${tag}${attrText}></${tag}>`);
      continue;
    }
    if (!node.children.length && text !== undefined) {
      out.push(`${indent}<${tag}${attrText}>${text}</${tag}>`);
      continue;
    }
    out.push(`${indent}<${tag}${attrText}>`);
    if (text !== undefined) out.push(`${indent}  ${text}`);
    for (const child of node.children) out.push(render(child, `${indent}  `, counters));
    out.push(`${indent}</${tag}>`);
  }
  return out.join("\n");
}

export function expandAbbreviation(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  // Allow spaces only inside `{text}` blocks; anything else isn't an abbreviation.
  if (/\s/.test(trimmed.replace(/\{[^}]*\}/g, ""))) return null;
  if (!/[>+#.*\[{]/.test(trimmed)) return null; // require Emmet syntax, not a bare word
  const node = parseAbbreviation(trimmed);
  if (!node) return null;
  return render(node, "", []);
}

/** The Emmet-ish token immediately before the caret, if any. */
export function abbreviationBefore(textBeforeCaret: string): string | null {
  const match = /[\w.#>+^*[\]{}=\-"']+$/.exec(textBeforeCaret);
  return match ? match[0] : null;
}
