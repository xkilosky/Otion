# Otion

**Live:** https://otion-tau.vercel.app — installable as a PWA, works offline once loaded.

A mobile-first code editor that runs entirely in the browser. Write HTML, CSS and
JavaScript, then watch it run in a sandboxed live preview — with console output
piped back into the editor.

```
┌──────────────────────────────────────────────────────┐
│ Otion · project            [Code | Preview]   ●  ⚙   │
├──────────────┬───────────────────────┬───────────────┤
│ index.html   │  <h1>Hello</h1>       │  ▶ preview     │
│ styles.css   │  ─────────────────    │                │
│ script.js    │  < > { } ( ) [ ] …    │  console ▴     │
└──────────────┴───────────────────────┴───────────────┘
```

## Why it's built for phones first

- **One pane at a time.** Below 860px the editor and the preview share the screen
  through a `Code | Preview` switch in the header, so lines never get squeezed.
- **A thumb keypad.** Brackets, quotes, arrows and indentation sit under the
  editor, plus a snippet row (`</>`, `() => {}`, `@media`, flex/grid, …) so you
  rarely need the symbol keyboard.
- **Keyboard-aware shell.** The layout follows `visualViewport`, so the caret and
  keypad stay visible above the on-screen keyboard, and the status bar steps out
  of the way while typing.
- **Touch-sized targets.** 34–46px hit areas, `touch-action: manipulation`, no
  tap highlight, safe-area padding for notched screens.
- **Light and heavy.** The editor stays smooth on a phone; Markdown and Python
  grammars are lazy-loaded.

## Features

- **Multi-file projects** with tabs, a rename/delete file list, and a new-file
  sheet with quick names.
- **Live preview** in a sandboxed iframe. `index.html` is the entry point;
  `<link rel="stylesheet">`, `<script src>` and local `<img src>` references are
  inlined automatically (images become data URLs) so the preview needs no server.
  With no `index.html`, CSS + JS files are assembled into a document for you.
- **Console + error capture.** `console.*`, uncaught errors and unhandled promise
  rejections from the preview are posted to the app, filtered by a per-session
  channel, and shown in a dock that opens itself when something throws.
- **Saturated syntax colours.** The default **Neon** palette is tuned for
  contrast: magenta keywords, hot-pink JSX/HTML tags, green attributes,
  acid-yellow attribute values and strings, cyan identifiers. Switch to
  **Classic** in Settings for the muted palette; both work in dark and light.
  Colour roles live in `src/lib/editorTheme.ts`, so a tag is never styled by
  accident — every CodeMirror token (`tagName`, `attributeName`,
  `attributeValue`, `content`, …) maps to a named role.
- **Templates.** *Hello Otion*, *Landing page* (responsive marketing site),
  *Dot Rush* (a 30-second touch game) and *JSX navigation* (a saturated-syntax
  showcase with a working hamburger menu).
- **Editor that behaves.** CodeMirror 6 with syntax highlighting, bracket
  matching/closing, autocomplete, find, code folding, line numbers, word-wrap and
  a keyboard-safe caret.
- **Format** for the active file — a dependency-free formatter: brace/bracket
  re-indentation for JS/CSS/JSON (string- and template-literal aware) and tag
  indentation for HTML, with `<script>`/`<style>`/`<pre>` bodies left untouched.
- **Preview widths** (fluid / 390px / 768px), reload, and *copy standalone HTML*
  of the bundled preview.
- **Persistent workspace.** Project and preferences autosave to `localStorage`;
  export/import a project as JSON to move between devices.
- **Dark and light themes**, two syntax presets, adjustable font size,
  installable as a PWA.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘`/`Ctrl` + `↵` | Run / refresh the preview |
| `⌘`/`Ctrl` + `S` | Save to this browser |
| `⌘`/`Ctrl` + `⇧` + `F` | Format the current file |
| `⌘`/`Ctrl` + `F` | Find in file |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
npm run preview  # serve the production build
npm run smoke    # headless checks: bundling, console bridge, format, persistence
```

`npm run smoke` boots the real app in jsdom (CodeMirror prints a harmless
"Window is not defined" warning there, which the runner filters out) and verifies
the preview bundler, the console bridge and channel filtering, mobile view
switching, template loading, duplicate-name handling and restore-from-storage.

## Project layout

```
src/
  App.tsx                 state, persistence, console bridge, shortcuts
  components/
    TopBar.tsx            brand, mobile Code/Preview switch, actions
    EditorPane.tsx        tabs, editor, keypad and snippet tray
    CodeEditor.tsx        CodeMirror 6 view + imperative insert API
    PreviewPane.tsx       debounced live preview, widths, copy/reload
    ConsolePanel.tsx      console dock
    FileList.tsx          file rows with rename/delete
    Sheet.tsx             bottom sheet (phone) / dialog (tablet+)
    SettingsSheet.tsx     appearance, project tools, tips
    TemplatePicker.tsx    starter projects
    Toast.tsx             transient status messages
  scripts/smoke.tsx       headless verification of logic + app behaviour
  lib/
    preview.ts            file bundling + runtime console bridge
    templates.ts          starter projects
    languages.ts          grammar mapping, badges, keypad catalog
    editorTheme.ts        Neon/Classic syntax palettes + dark/light chrome
    format.ts             brace-aware re-indenter
    storage.ts            localStorage read/write with fallbacks
  styles/global.css       design tokens + mobile-first layout
```

## Deploying

The app is deployed on Vercel from this repository (`vercel.json` pins the Vite
preset, `dist` output, `npm ci`, an SPA rewrite and asset caching):

```bash
vercel            # or connect the repo in the Vercel dashboard
```

Any push that Vercel builds produces a preview URL; the branch alias for this
work is `otion-git-arena-b97692f8-otion-flux-cf70.vercel.app`, and production is
`otion-tau.vercel.app`.

## Notes

The preview runs in `<iframe sandbox="allow-scripts allow-modals allow-popups
allow-forms allow-same-origin">`. The sandbox blocks top-level navigation and
opener access, but because the frame is same-origin (so `localStorage`, cookies
and friends behave like a normal page for your project) it is **not** a security
boundary against hostile code — treat pasted code the way you would any snippet
you run in a browser tab.

Everything runs client-side — there is no backend, account, or telemetry.
