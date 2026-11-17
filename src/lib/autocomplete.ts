import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionSource,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";

/**
 * Editor-intelligence extras: HTML tag auto-closing, context-aware snippets and
 * a small HTML/CSS vocabulary. Kept dependency-free and fast so the phone
 * keyboard doesn't stutter.
 */

const js = (label: string, detail: string, body: string): Completion => ({
  label,
  detail,
  type: "keyword",
  apply: snippet(body),
});

const JS_SNIPPETS: Completion[] = [
  js("log", "console.log", 'console.log(${})'),
  js("warn", "console.warn", 'console.warn(${})'),
  js("error", "console.error", 'console.error(${})'),
  js("fn", "function", "function ${name}(${}) {\n  \n}"),
  js("afn", "arrow function", "(${}) => {\n  \n}"),
  js("afnexpr", "arrow expression", "(${}) => ${}"),
  js("if", "if statement", "if (${condition}) {\n  \n}"),
  js("ife", "if / else", "if (${condition}) {\n  \n} else {\n  \n}"),
  js("for", "for loop", "for (let i = 0; i < ${n}; i++) {\n  \n}"),
  js("forof", "for…of", "for (const ${item} of ${items}) {\n  \n}"),
  js("while", "while loop", "while (${condition}) {\n  \n}"),
  js("switch", "switch", "switch (${value}) {\n  case ${a}:\n    break;\n  default:\n    break;\n}"),
  js("try", "try / catch", "try {\n  \n} catch (error) {\n  console.error(error);\n}"),
  js("class", "class", "class ${Name} {\n  constructor(${}) {\n    \n  }\n}"),
  js("import", "import", 'import { ${} } from "${}";'),
  js("exportdef", "export default", "export default ${}"),
  js("async", "async function", "async function ${name}(${}) {\n  \n}"),
  js("await", "await", "await ${}"),
  js("promise", "fetch + then", 'fetch("${url}")\n  .then((response) => response.json())\n  .then((data) => console.log(data))'),
  js("settimeout", "setTimeout", "setTimeout(() => {\n  \n}, ${100});"),
  js("addev", "addEventListener", '${element}.addEventListener("${click}", (event) => {\n  \n});'),
  js("query", "querySelector", 'document.querySelector("${selector}")'),
  js("getid", "getElementById", 'document.getElementById("${id}")'),
  js("map", "array.map", "${arr}.map((item) => ${item})"),
  js("filter", "array.filter", "${arr}.filter((item) => ${condition})"),
  js("reduce", "array.reduce", "${arr}.reduce((sum, item) => sum + item, 0)"),
  js("destructure", "destructure", "const { ${a}, ${b} } = ${object};"),
  js("ternary", "ternary", "${condition} ? ${a} : ${b}"),
  js("iife", "IIFE", "(() => {\n  \n})();"),
];

const CSS_SNIPPETS: Completion[] = [
  js("flexcenter", "flex centered", "display: flex;\nalign-items: center;\njustify-content: center;"),
  js("grid", "grid columns", "display: grid;\ngrid-template-columns: repeat(${3}, 1fr);\ngap: ${16}px;"),
  js("media", "media query", "@media (max-width: ${600}px) {\n  \n}"),
  js("vartheme", "custom property", "--${name}: ${value};"),
  js("gradient", "gradient", "background: linear-gradient(${135}deg, ${#a}, ${#b});"),
  js("transition", "transition", "transition: ${all} ${0.2}s ${ease};"),
  js("shadow", "box shadow", "box-shadow: 0 ${2}px ${8}px rgba(0, 0, 0, 0.2);"),
  js("animation", "keyframes", "@keyframes ${name} {\n  from {\n    \n  }\n  to {\n    \n  }\n}"),
  js("clamp", "clamp()", "clamp(${1}rem, ${2}vw, ${3}rem)"),
  js("backdrop", "blur backdrop", "backdrop-filter: blur(${12}px);"),
];

const HTML_SNIPPETS: Completion[] = [
  js("!", "HTML5 boilerplate", "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>${Document}</title>\n</head>\n<body>\n  \n</body>\n</html>"),
  js("meta", "viewport meta", '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'),
  js("linkcss", "stylesheet link", '<link rel="stylesheet" href="${styles.css}" />'),
  js("scriptsrc", "script tag", '<script src="${script.js}"></script>'),
  js("figure", "figure", '<figure>\n  <img src="${}" alt="${}" />\n  <figcaption>${}</figcaption>\n</figure>'),
  js("details", "details / summary", "<details>\n  <summary>${}</summary>\n  \n</details>"),
  js("form", "form", '<form action="${}" method="${post}">\n  \n</form>'),
];

const HTML_TAGS = [
  "a", "abbr", "address", "article", "aside", "audio", "b", "blockquote", "body", "br",
  "button", "canvas", "caption", "code", "details", "dialog", "div", "dl", "dt", "dd",
  "em", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "head", "header", "hr", "html", "i", "iframe", "img", "input", "label",
  "li", "link", "main", "menu", "meta", "nav", "ol", "option", "p", "picture", "pre",
  "progress", "script", "section", "select", "small", "source", "span", "strong",
  "style", "summary", "svg", "table", "tbody", "td", "template", "textarea", "th",
  "thead", "time", "title", "tr", "ul", "video",
];

const CSS_PROPERTIES = [
  "align-items", "animation", "aspect-ratio", "backdrop-filter", "background",
  "background-color", "background-image", "border", "border-radius", "bottom",
  "box-shadow", "box-sizing", "color", "column-gap", "content", "cursor", "display",
  "filter", "flex", "flex-direction", "flex-wrap", "font-family", "font-size",
  "font-weight", "gap", "grid-template-columns", "grid-template-rows", "height",
  "inset", "justify-content", "left", "letter-spacing", "line-height", "margin",
  "max-height", "max-width", "min-height", "min-width", "object-fit", "opacity",
  "outline", "overflow", "padding", "place-items", "position", "right", "text-align",
  "text-decoration", "text-transform", "top", "transform", "transition", "user-select",
  "visibility", "width", "z-index",
];

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const snippetSource =
  (items: Completion[]): CompletionSource =>
  (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[a-zA-Z!][\w!-]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    return { from: word.from, options: items, validFor: /^[\w!-]*$/ };
  };

const tagSource: CompletionSource = (context) => {
  const before = context.matchBefore(/<\/?[\w:-]*/);
  if (!before || (before.from === before.to && !context.explicit)) return null;
  const closing = before.text.startsWith("</");
  return {
    from: before.from + (closing ? 2 : 1),
    options: HTML_TAGS.map((tag) => ({ label: tag, type: "type" })),
    validFor: /^[\w:-]*$/,
  };
};

const cssPropertySource: CompletionSource = (context) => {
  const before = context.matchBefore(/[\w-]+/);
  if (!before || (before.from === before.to && !context.explicit)) return null;
  return {
    from: before.from,
    options: CSS_PROPERTIES.map((property) => ({ label: property, type: "property" })),
    validFor: /^[\w-]*$/,
  };
};

const cssValueSource: CompletionSource = (context) => {
  const before = context.matchBefore(/[a-z-]+: *[\w#-]*/);
  if (!before) return null;
  const values = [
    "flex", "grid", "block", "inline-flex", "inline-block", "none", "absolute",
    "relative", "sticky", "fixed", "center", "space-between", "space-around",
    "1fr", "auto", "hidden", "visible", "pointer", "inherit", "currentColor",
  ];
  return {
    from: before.to - (/[\w#-]*$/.exec(before.text)?.[0].length ?? 0),
    options: values.map((value) => ({ label: value, type: "constant" })),
  };
};

const javascriptSource: CompletionSource = (context) => {
  const word = context.matchBefore(/[\w$]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const globals = [
    "console", "document", "window", "localStorage", "sessionStorage", "fetch",
    "navigator", "location", "setTimeout", "setInterval", "requestAnimationFrame",
    "Promise", "JSON", "Math", "Object", "Array", "String", "Number", "Date",
    "Map", "Set", "Intl", "URL", "URLSearchParams", "CustomEvent", "structuredClone",
  ].map((label) => ({ label, type: "variable" }));
  return { from: word.from, options: globals, validFor: /^[\w$]*$/ };
};

export function completionsForFile(fileName: string) {
  switch (extensionOf(fileName)) {
    case "html":
    case "htm":
    case "svg":
      return autocompletion({
        activateOnTyping: true,
        maxRenderedOptions: 40,
        override: [tagSource, snippetSource(HTML_SNIPPETS)],
      });
    case "css":
      return autocompletion({
        activateOnTyping: true,
        maxRenderedOptions: 40,
        override: [cssValueSource, cssPropertySource, snippetSource(CSS_SNIPPETS)],
      });
    case "js":
    case "mjs":
    case "cjs":
    case "jsx":
    case "ts":
    case "tsx":
      return autocompletion({
        activateOnTyping: true,
        maxRenderedOptions: 40,
        override: [snippetSource(JS_SNIPPETS), javascriptSource],
      });
    default:
      return autocompletion({ activateOnTyping: true, maxRenderedOptions: 30 });
  }
}

export { closeBrackets, closeBracketsKeymap, completionKeymap };

/**
 * Typing `>` after an opening HTML tag inserts the matching closing tag and
 * parks the caret between them. Pressing `>` on a self-closing or void tag does
 * nothing. Also closes a tag when the caret is right before `</…>` duplicates.
 */
export const autoCloseTag = (fileName: string) => (event: KeyboardEvent, getState: () => any) => {
  if (event.key !== ">" || event.metaKey || event.ctrlKey || event.altKey) return false;
  if (!["html", "htm", "svg"].includes(extensionOf(fileName))) return false;

  const state = getState();
  if (!state) return false;
  const { from, to } = state.selection.main;
  if (from !== to) return false;

  const line = state.doc.lineAt(from);
  const before = state.sliceDoc(line.from, from);
  const match = /<([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>])*)$/.exec(before);
  if (!match) return false;

  const tag = match[1];
  const rest = match[2];
  if (rest.trimEnd().endsWith("/")) return false;
  if (["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(tag.toLowerCase())) {
    return false;
  }

  // Look ahead: if the same closing tag is already typed, just move past it.
  const after = state.sliceDoc(from, Math.min(from + tag.length + 3, state.doc.length));
  const closing = `</${tag}>`;
  if (after.toLowerCase().startsWith(closing.toLowerCase())) {
    return { move: from + closing.length };
  }

  return { insert: `>${closing}`, caret: from + 1 };
};

export { EditorSelection };
