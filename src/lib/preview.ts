import type { ProjectFile } from "../types";

/**
 * Turns the project's files into a single self-contained HTML document that can
 * be dropped into an iframe `srcdoc`. Scripts, stylesheets and image sources are
 * inlined so the preview works with no server, no network and no blob URLs.
 */

const normalize = (path: string) =>
  path
    .replace(/^\.\//, "")
    .replace(/^\//, "")
    .split(/[?#]/)[0]
    .toLowerCase();

const lookup = (files: ProjectFile[], path: string) => {
  const target = normalize(path);
  return (
    files.find((file) => normalize(file.name) === target) ??
    files.find((file) => normalize(file.name.split("/").pop() ?? "") === target)
  );
};

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
};

const isDataUrl = (value: string) => /^data:[a-z-]+\/[a-z0-9.+-]+;base64,/i.test(value);

/** Runtime bridge (installed before any user script) that pipes console output
 *  and runtime errors up to the Otion app. Runs inside the iframe only. */
const bridge = (channel: string) => `<script>
(function () {
  var channel = ${JSON.stringify(channel)};
  var seq = 0;
  function send(level, text) {
    try {
      parent.postMessage({ __otion: true, channel: channel, level: level, text: text, id: ++seq }, "*");
    } catch (err) {}
  }
  function fmt(value, depth) {
    depth = depth || 0;
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    var type = typeof value;
    if (type === "string") return depth === 0 ? value : JSON.stringify(value);
    if (type === "number" || type === "boolean" || type === "bigint") return String(value);
    if (type === "function") return "ƒ " + (value.name || "anonymous") + "()";
    if (value instanceof Error) return (value.name || "Error") + ": " + value.message;
    if (value instanceof Element) return "<" + value.tagName.toLowerCase() + ">";
    if (typeof Node !== "undefined" && value instanceof Node) return "#" + (value.nodeName || "node");
    if (depth > 2) return Array.isArray(value) ? "[…]" : "{…}";
    try {
      if (Array.isArray(value)) {
        return "[" + value.slice(0, 25).map(function (v) { return fmt(v, depth + 1); }).join(", ") + "]";
      }
      var keys = Object.keys(value).slice(0, 20);
      return "{ " + keys.map(function (k) { return k + ": " + fmt(value[k], depth + 1); }).join(", ") + " }";
    } catch (err) {
      return String(value);
    }
  }
  ["log", "info", "warn", "error", "debug"].forEach(function (level) {
    var original = console[level] ? console[level].bind(console) : function () {};
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      var text = args.map(function (a) { return fmt(a); }).join(" ");
      send(level === "debug" ? "debug" : level, text);
      try { original.apply(console, args); } catch (err) {}
    };
  });
  window.addEventListener("error", function (event) {
    send("error", (event.message || "Error") + (event.lineno ? " (line " + event.lineno + ")" : ""));
  });
  window.addEventListener("unhandledrejection", function (event) {
    var reason = event.reason;
    send("error", "Unhandled promise rejection: " + (reason && reason.message ? reason.message : fmt(reason)));
  });
  send("system", "Preview connected");
})();
</script>`;

const cssToStyle = (css: string) => `<style>\n${css}\n</style>`;

const jsToScript = (js: string, name: string) =>
  `<script data-file="${name}">\n${js.replace(/<\/script>/gi, "<\\/script>")}\n</script>`;

function inlineLinks(html: string, files: ProjectFile[]) {
  return html.replace(
    /<link\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, href: string) => {
      if (!/stylesheet/i.test(match) && !/\.css(\?|$)/i.test(href)) return match;
      const file = lookup(files, href);
      if (file) return cssToStyle(file.content);
      if (/^https?:\/\//i.test(href)) return match;
      return `<!-- Otion: missing stylesheet "${href}" -->`;
    },
  );
}

function inlineScripts(html: string, files: ProjectFile[]) {
  return html.replace(
    /<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (_match, _pre, src: string, _post) => {
      const file = lookup(files, src);
      if (file) return jsToScript(file.content, file.name);
      if (/^https?:\/\//i.test(src)) return _match;
      return `<script>console.warn(${JSON.stringify(
        `Otion: script "${src}" was not found`,
      )})</script>`;
    },
  );
}

function inlineImages(html: string, files: ProjectFile[]) {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*["'])([^"']+)(["'])/gi,
    (match, pre: string, src: string, post: string) => {
      if (isDataUrl(src) || /^https?:\/\//i.test(src)) return match;
      const file = lookup(files, src);
      if (!file) return match;
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const mime = MIME[ext];
      if (!mime) return match;
      return `${pre}data:${mime};base64,${file.content.trim()}${post}`;
    },
  );
}

function inferredDocument(files: ProjectFile[]) {
  const css = files.filter((f) => /\.css$/i.test(f.name));
  const js = files.filter((f) => /\.(m?js|jsx)$/i.test(f.name));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Otion preview</title>
  ${css.map((file) => cssToStyle(file.content)).join("\n  ")}
</head>
<body>
  ${js
    .map(
      (file) =>
        `<script data-file="${file.name}">\n${file.content.replace(
          /<\/script>/gi,
          "<\\/script>",
        )}\n</script>`,
    )
    .join("\n  ")}
</body>
</html>`;
}

export interface PreviewOptions {
  channel: string;
  theme: "dark" | "light";
}

export function buildPreviewDocument(files: ProjectFile[], options: PreviewOptions) {
  const entry =
    files.find((file) => normalize(file.name) === "index.html") ??
    files.find((file) => /\.html?$/i.test(file.name));

  let html = entry ? entry.content : inferredDocument(files);

  if (entry) {
    html = inlineLinks(html, files);
    html = inlineScripts(html, files);
    html = inlineImages(html, files);
  }

  const inject = `${bridge(options.channel)}
<style>
  html { color-scheme: ${options.theme}; }
  #otion-empty-hint { position: fixed; inset: auto 0 0 0; padding: 16px 18px; font: 13px/1.5 system-ui, sans-serif; color: #9aa3b8; background: rgba(15,18,28,.9); }
</style>`;

  if (/<head\b[^>]*>/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (head) => `${head}\n${inject}`);
  } else if (/<html\b[^>]*>/i.test(html)) {
    html = html.replace(/<html\b[^>]*>/i, (root) => `${root}\n<head>${inject}</head>`);
  } else {
    html = `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`;
  }

  return html;
}
