/**
 * Otion smoke test — runs the real app in jsdom and exercises the pieces that
 * are easy to break: file bundling + console bridge, formatting, templates,
 * mobile view switching, and project persistence.
 *
 *   npm run smoke
 *
 * (CodeMirror needs a real layout engine, so it logs harmless "Window is not
 * defined" warnings under jsdom; those are filtered out below.)
 */
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import * as React from "react";
import App from "../src/App";
import { formatCode } from "../src/lib/format";
import { buildPreviewDocument } from "../src/lib/preview";
import { projectFromTemplate, templates } from "../src/lib/templates";
import { fileBadge, languageForFile, lazyLanguageForFile } from "../src/lib/languages";
import { editorTheme, paletteFor, tagSpecs } from "../src/lib/editorTheme";
import { javascriptLanguage } from "@codemirror/lang-javascript";
import { highlightTree, tagHighlighter } from "@lezer/highlight";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
const say = (label: string, condition: boolean, extra = "") => {
  if (!condition) failures += 1;
  console.log(`${condition ? "ok  " : "FAIL"}: ${label}${condition ? "" : ` :: ${extra}`}`);
};

const mount = (seed?: Record<string, string>) => {
  const dom = new JSDOM(
    `<!DOCTYPE html><html data-theme="dark"><head><meta name="theme-color" content="#000"></head><body><div id="root"></div></body></html>`,
    { pretendToBeVisual: true, url: "http://localhost:5173/" },
  );
  const g = globalThis as any;
  g.window = dom.window;
  g.document = dom.window.document;
  Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
  for (const key of [
    "HTMLElement",
    "HTMLInputElement",
    "Element",
    "Node",
    "Event",
    "CustomEvent",
    "KeyboardEvent",
    "MouseEvent",
    "DOMRect",
    "Range",
    "MutationObserver",
    "getComputedStyle",
  ]) {
    g[key] = (dom.window as any)[key];
  }
  g.PointerEvent = dom.window.PointerEvent ?? dom.window.MouseEvent;
  g.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
  g.cancelAnimationFrame = (id: any) => clearTimeout(id);
  g.localStorage = dom.window.localStorage;
  g.IS_REACT_ACT_ENVIRONMENT = false;

  if (seed) {
    for (const [key, value] of Object.entries(seed)) dom.window.localStorage.setItem(key, value);
  }

  const errors: string[] = [];
  dom.window.addEventListener("error", (event: any) => {
    if (!/Window is not defined/.test(String(event.message))) errors.push(String(event.message));
  });
  return { dom, errors };
};

const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find(
    (element) => (element.getAttribute("aria-label") ?? element.textContent ?? "").trim() === label,
  ) as HTMLElement | undefined;

/* ------------------------------- pure logic ------------------------------- */

async function logicSuite() {
  for (const template of templates) {
    const files = projectFromTemplate(template.id).files;
    for (const file of files) {
      const once = formatCode(file.content, file.name);
      if (once !== formatCode(once, file.name)) {
        say(`${template.id}/${file.name}: format is stable`, false);
      }
      if (/\.js$/.test(file.name)) {
        let parses = true;
        try {
          new Function(once);
        } catch {
          parses = false;
        }
        say(`${template.id}/${file.name}: still valid after formatting`, parses);
      }
    }

    const doc = buildPreviewDocument(files, { channel: "smoke", theme: "dark" });
    say(`${template.id}: CSS inlined`, doc.includes("<style>"));
    say(`${template.id}: JS inlined`, /<script data-file=/.test(doc));
    say(`${template.id}: console bridge injected`, doc.includes("__otion"));
    say(`${template.id}: no unresolved local links`, !/<link[^>]+href="styles\.css"/i.test(doc));
  }

  const markup = formatCode(`<div>\n<p>hi</p>\n<script>\nrun();\n</script>\n</div>`, "index.html");
  say(
    "markup formatter indents tags, leaves script bodies alone",
    markup === `<div>\n  <p>hi</p>\n  <script>\nrun();\n  </script>\n</div>`,
    JSON.stringify(markup),
  );

  // --- saturated "neon" syntax: JSX tags pink, attributes green, values yellow
  const neon = paletteFor("dark", "neon");
  const specs = tagSpecs(neon).map((spec, index) => ({ ...spec, class: `t${index}` }));
  const colourOf = new Map(specs.map((spec) => [spec.class, spec.color]));
  const highlighter = tagHighlighter(specs.map(({ tag, class: cls }) => ({ tag, class: cls })));
  const jsx = `export default function Navigation() {
  return (
    <Section id="navigation">
      <NavBar />
    </Section>
  );
}`;
  const tree = javascriptLanguage.parser.configure({ dialect: "jsx" }).parse(jsx);
  const tokens: Record<string, string> = {};
  highlightTree(tree, highlighter, (from, to, classes) => {
    const text = jsx.slice(from, to).trim();
    if (text && !tokens[text]) tokens[text] = colourOf.get(classes.split(" ")[0]) ?? "unmapped";
  });

  say("neon: export keyword is saturated magenta", tokens["export"] === "#ff4fd8", tokens["export"]);
  say("neon: JSX tag names are hot pink", tokens["Section"] === "#ff3d8b", tokens["Section"]);
  say("neon: JSX attributes are green", tokens["id"] === "#5cff95", tokens["id"]);
  say("neon: attribute values are acid yellow", tokens['"navigation"'] === "#d8ff66", tokens['"navigation"']);
  say("neon: identifiers are cyan", tokens["Navigation"] === "#4fe3ff", tokens["Navigation"]);
  say("neon: every JSX token is mapped", !Object.values(tokens).includes("unmapped"), JSON.stringify(tokens));
  say("classic preset differs", paletteFor("dark", "classic").tag !== neon.tag);
  say(
    "both presets build extensions",
    ["neon", "classic"].every((preset) => editorTheme("dark", preset as "neon").length === 2),
  );

  // Regression: the lazy grammar loader must report "nothing to load" as null,
  // never an empty extension — an empty array would reconfigure the language
  // compartment and strip the grammar (which silently killed all highlighting).
  const lazyHtml = await lazyLanguageForFile("index.html");
  const lazyMd = await lazyLanguageForFile("notes.md");
  say("lazy loader returns null for eager languages", lazyHtml === null, String(lazyHtml));
  say("lazy loader loads markdown on demand", Boolean(lazyMd) && lazyMd !== null);
  say("languageForFile returns a grammar for html", languageForFile("index.html") !== null);
  say("languageForFile returns null for plain text", languageForFile("notes.txt") === null);

  say("badge mapping", fileBadge("index.html") === "HTML" && fileBadge("App.tsx") === "JS");

  const inferred = buildPreviewDocument(
    [
      { id: "1", name: "main.js", content: 'console.log("x")' },
      { id: "2", name: "styles.css", content: "body{color:red}" },
    ],
    { channel: "smoke", theme: "light" },
  );
  say("no-index project is assembled", inferred.includes("body{color:red}") && inferred.includes("console.log"));

  // The formatter re-indents, it never re-spaces tokens — braces stay where the
  // author put them, and a string containing "}{" must not shift the depth.
  const formatted = formatCode(`function a(){\nif(x){\nreturn "}{";\n}\n}`, "a.js");
  say(
    "formatter indents blocks",
    formatted === `function a(){\n  if(x){\n    return "}{";\n  }\n}`,
    JSON.stringify(formatted),
  );
}

/* ---------------------------------- app ---------------------------------- */

async function appSuite() {
  const { dom, errors } = mount();
  createRoot(document.getElementById("root")!).render(React.createElement(App));
  await sleep(1200);

  const text = document.body.textContent ?? "";
  say("app mounts", text.includes("Otion") && text.includes("index.html"));
  say("editor renders", !!document.querySelector(".cm-editor"));
  say("preview iframe renders", !!document.querySelector("iframe.preview-frame"));
  say("keypad renders", document.querySelectorAll(".keypad .key").length > 20);
  say("console dock renders", !!document.querySelector(".console__bar"));

  const srcdoc = document.querySelector("iframe.preview-frame")!.getAttribute("srcdoc") ?? "";
  const channel = /var channel = "([^"]+)"/.exec(srcdoc)?.[1] ?? "";
  say("preview document carries the file contents", srcdoc.includes(".card") && srcdoc.includes("Otion is ready"));
  say("preview channel assigned", channel.startsWith("otion-"));

  // Regression: highlighting must be rendered, not just configured.
  const cssText = Array.from(document.querySelectorAll("style"))
    .map((node) => node.textContent ?? "")
    .join("\n");
  const colourOfClass = (cls: string) => {
    const rule = new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`).exec(cssText);
    return rule ? (/#[0-9a-f]{6}/i.exec(rule[1])?.[0] ?? "?") : "?";
  };
  const renderedTokens = new Map<string, string>();
  Array.from(document.querySelectorAll(".cm-line span")).forEach((span) => {
    const text = span.textContent ?? "";
    if (text.trim() && !renderedTokens.has(text)) {
      renderedTokens.set(text, colourOfClass(span.className.split(" ")[0]));
    }
  });
  say("editor renders highlighted tokens", renderedTokens.size > 8, String(renderedTokens.size));
  say(
    "rendered HTML tag names are hot pink",
    renderedTokens.get("main") === "#ff3d8b",
    renderedTokens.get("main"),
  );
  say(
    "rendered attributes are green",
    renderedTokens.get("class") === "#5cff95",
    renderedTokens.get("class"),
  );
  say("no token renders uncoloured", ![...renderedTokens.values()].includes("?"));

  dom.window.postMessage({ __otion: true, channel, level: "log", text: "hello from frame" }, "*");
  dom.window.postMessage({ __otion: true, channel: "not-ours", level: "error", text: "ignore me" }, "*");
  await sleep(120);
  (document.querySelector(".console__bar") as HTMLElement).click();
  await sleep(150);
  const logs = Array.from(document.querySelectorAll(".log__text")).map((node) => node.textContent);
  say("console bridge forwards logs", logs.includes("hello from frame"), JSON.stringify(logs));
  say("console bridge ignores other channels", !logs.includes("ignore me"));

  // mobile Code/Preview switch
  const previewTab = Array.from(document.querySelectorAll(".topbar__mobile-switch button")).find(
    (element) => element.textContent === "Preview",
  ) as HTMLElement;
  previewTab.click();
  await sleep(150);
  say("mobile switch shows preview", !!document.querySelector(".app.view-preview"));
  say("mobile view persists", JSON.parse(localStorage.getItem("otion.prefs.v1") ?? "{}").mobileView === "preview");
  (Array.from(document.querySelectorAll(".topbar__mobile-switch button")).find(
    (element) => element.textContent === "Code",
  ) as HTMLElement).click();
  await sleep(100);

  // settings + theme
  button("Settings")!.click();
  await sleep(200);
  say("settings sheet opens", !!document.querySelector(".sheet"));
  (Array.from(document.querySelectorAll(".sheet button")).find(
    (element) => element.textContent === "Light",
  ) as HTMLElement).click();
  await sleep(150);
  say("theme switches to light", document.documentElement.dataset.theme === "light");
  (document.querySelector(".sheet__head .icon-btn") as HTMLElement).click();
  await sleep(150);

  // syntax preset picker
  button("Settings")!.click();
  await sleep(200);
  const classic = Array.from(document.querySelectorAll(".syntax-option")).find(
    (element) => element.textContent?.includes("Classic"),
  ) as HTMLElement;
  say("syntax picker offers both presets", document.querySelectorAll(".syntax-option").length === 2);
  classic.click();
  await sleep(200);
  say("syntax preset applies", JSON.parse(localStorage.getItem("otion.prefs.v1") ?? "{}").syntax === "classic");
  (document.querySelector(".sheet__head .icon-btn") as HTMLElement).click();
  await sleep(150);

  // templates
  button("New from template")!.click();
  await sleep(200);
  const cards = document.querySelectorAll(".template-card");
  say("templates offered", cards.length === templates.length);
  (Array.from(cards).find((card) => card.textContent?.includes("Dot Rush")) as HTMLElement).click();
  await sleep(800);
  const tabs = Array.from(document.querySelectorAll(".tab__name")).map((node) => node.textContent);
  say("template files open", tabs.join(",") === "index.html,styles.css,game.js", tabs.join(","));
  const gameDoc = document.querySelector("iframe.preview-frame")!.getAttribute("srcdoc") ?? "";
  say("template preview bundled", gameDoc.includes("Dot Rush") && gameDoc.includes("startGame"));

  // new file + duplicate guard
  button("New file")!.click();
  await sleep(200);
  const pick = async (name: string) => {
    (Array.from(document.querySelectorAll(".quick-names button")).find(
      (element) => element.textContent === name,
    ) as HTMLElement).click();
    await sleep(120);
  };
  await pick("README.md");
  (Array.from(document.querySelectorAll(".sheet__foot button")).find(
    (element) => element.textContent === "Create file",
  ) as HTMLElement).click();
  await sleep(350);
  say("new file opens", document.querySelector(".tab.is-active .tab__name")?.textContent === "README.md");

  button("New file")!.click();
  await sleep(150);
  await pick("README.md");
  (Array.from(document.querySelectorAll(".sheet__foot button")).find(
    (element) => element.textContent === "Create file",
  ) as HTMLElement).click();
  await sleep(250);
  say("duplicate names rejected", document.querySelectorAll(".tab__name").length === 4);
  say("duplicate shows a toast", (document.querySelector(".toast")?.textContent ?? "").includes("already exists"));

  await sleep(700);
  const saved = localStorage.getItem("otion.project.v1") ?? "";
  say("project autosaved", saved.includes("Dot Rush") && saved.includes("README.md"));
  say("no runtime errors", errors.length === 0, errors.join(" | "));
}

/* ------------------------------ persistence ------------------------------- */

async function restoreSuite() {
  const project = JSON.stringify({
    id: "p_seed",
    name: "Restored workspace",
    files: [
      {
        id: "a",
        name: "index.html",
        content: '<link rel="stylesheet" href="theme.css" />\n<h1>restored</h1>',
      },
      { id: "b", name: "theme.css", content: "h1{color:red}" },
    ],
  });
  const { dom } = mount({
    "otion.project.v1": project,
    "otion.activeFile.v1": "b",
    "otion.prefs.v1": JSON.stringify({ theme: "light", fontSize: 18, wordWrap: false, mobileView: "editor", keypad: true }),
  });
  createRoot(document.getElementById("root")!).render(React.createElement(App));
  await sleep(900);

  say("project restored", document.body.textContent?.includes("Restored workspace"));
  say("last file restored", document.querySelector(".tab.is-active .tab__name")?.textContent === "theme.css");
  say("prefs restored", document.documentElement.dataset.theme === "light");
  const srcdoc = document.querySelector("iframe.preview-frame")!.getAttribute("srcdoc") ?? "";
  say("restored project previews", srcdoc.includes("<h1>restored</h1>") && srcdoc.includes("h1{color:red}"));
  dom.window.close();
}

async function main() {
  console.log("\n— logic —");
  await logicSuite();
  console.log("\n— app —");
  await appSuite();
  console.log("\n— persistence —");
  await restoreSuite();

  console.log(failures ? `\n${failures} check(s) failed\n` : "\nAll checks passed ✦\n");
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error("smoke runner crashed:", error);
  process.exit(1);
});
