# Otion

**Live:** https://otion-tau.vercel.app — installable as a PWA, works offline once loaded.

A mobile-first code editor that runs entirely in the browser. Write HTML, CSS and
JavaScript, then watch it run in a sandboxed live preview — with console output
piped back into the editor. The editing surface is VS Code-class: completions,
snippets, Emmet, live problems, an outline, breadcrumbs, a minimap, a command
palette and a real status bar — all sized for a thumb.

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

## Layout

- **Resizable split.** From 860px up the editor and preview share the screen
  with a draggable divider (drag it, `←`/`→` when focused, double-click or
  `Enter` to reset to 50/50). Your ratio is remembered, and it can also be set
  from Settings or the command palette ("Give the editor more room").
- **Four phone modes.** The icon switch in the header cycles *code only →
  stacked split → preview first → preview only*. In the two stacked modes the
  ratio lives on a slider **on the divider** (`Code ──●── Preview`), so the
  header keeps one row of controls and nothing overlaps at 320px.
- **Project rail.** A vertical strip of recent projects docked beside the file
  list. Icon-only by default so file names keep their room; the `‹` toggle
  expands it to names. The open project is highlighted.
- **Zen mode** (`⌘⇧Z`). Strips the chrome down to the code: no rail, keypad,
  footer, dock or status bar, and a slim transparent header.
- **Breakpoints that earn their space:** one pane + layout switch below 860px,
  two panes with a divider from 860px, and the file rail joins at 1120px.
- **Nothing overlaps, on purpose.** The header sheds optional buttons in order
  (templates → live → switcher → search → project name), the dock publishes its
  own height as `--dock-h` so toasts and the search panel clear it, and the
  workspace is its own stacking context so in-pane panels never cover the dock.

## Projects

Otion keeps as many projects as you like, all in this browser.

- **Project switcher** (`⌘⇧E`, the `▦` chip in the header, or the row above the
  file list on desktop) lists every project with file/line counts, size, "last
  edited", and health tags — `html`/`css`/`js` present, `TODO` count, empty files.
- **Create** a blank project, or start from any template — a template always
  becomes its own project, so nothing you were working on is replaced.
- **Duplicate** (⧉) to fork before experimenting, **star** (★) to pin, add a
  **description**, **rename**, **export** one project as JSON, or **delete** it
  after an in-app confirmation.
- **Import** accepts a single project or a whole workspace export; the legacy
  v1 project key is migrated automatically on first load.
- Each project remembers its own open file, and switching projects resets the
  preview channel and console.

## Features

- **Multi-file projects** with tabs, a rename/delete file list, and a new-file
  sheet with quick names.
- **Search & replace across the project** (`⌘⇧H`): case / whole-word / regex
  flags, quick-search chips with live counts (`console.log`, `TODO`, `@media`,
  `class=`, `id=`, `px`), results grouped per file with highlighted hits, tap a
  match to jump to that line, and replace-all.
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
- **Completions and snippets** that know the file type: HTML tags (with attribute
  hints), CSS properties and at-rules, JS globals plus snippet templates
  (`log`, `fn`, `afn`, `fori`, `try`, `imp`, `sel`, `flex`, `grid`, …).
- **Emmet on Tab.** `ul>li*3`, `section.hero>h1{Title}+p.sub`, `div>div^p`,
  `img.hero`, `a#top`, `input[type=email]` — expanded in place, with sensible
  implied attributes (`href`, `src`, `type`) so the result is usable immediately.
- **Live problems.** In-browser linters for HTML (unbalanced/mismatched tags),
  CSS (missing colons/braces), JSON (parse errors with position) and JavaScript
  (syntax errors from the parser), shown as gutter markers, squiggles, a Problems
  list and F8/⇧F8 navigation. Errors and warnings are counted in the status bar.
- **Outline, breadcrumbs, minimap.** A symbol outline for HTML (structure, ids,
  classes), CSS (selectors), JS/TS (functions, classes, constants) and Markdown
  (headings); breadcrumbs that follow the caret; and a minimap you can drag to
  scroll.
- **Command palette.** `⌘`/`Ctrl` + `⇧` + `P` (or just `⌘P`) lists every action —
  run, save, format, search, problems, go-to-line, theme, syntax, minimap, wrap,
  console — and `#name` switches files. On phones the `⋯` chip opens the same
  actions as a touch tray.
- **Line-level power tools.** Multi-cursor (`⌘D` select-next-occurrence,
  `⌥⌘↑/↓` add cursor), move lines (`⌥↑/↓`), duplicate (`⇧⌘D`), delete line
  (`⇧⌘K`), toggle comment (`⌘/` — HTML, CSS and JS aware), jump to matching
  bracket, and go-to-line.
- **Status bar.** Language, cursor position, selection size, line/word counts,
  problem badges, live-preview state and autosave status — each one tappable.
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
| `⌘`/`Ctrl` + `⇧` + `P` | Command palette (also `⌘P`) — includes project switching |
| `⌘`/`Ctrl` + `⇧` + `E` | Project switcher |
| `⌘`/`Ctrl` + `⇧` + `H` | Search across the project |
| `⌘`/`Ctrl` + `⇧` + `Z` | Zen mode |
| `⌘`/`Ctrl` + `⇧` + `F` | Format the current file (also `⌥⌘L`) |
| `⌘`/`Ctrl` + `F` | Find in file (`⌘G` — go to line) |
| `Tab` | Expand an Emmet abbreviation, else accept a completion |
| `⌥` + `↑` / `↓` | Move the current line |
| `⇧⌘D` / `⇧⌘K` | Duplicate line / delete line |
| `⌘D` | Select the next occurrence (multi-cursor) |
| `⌘⇧M` / `⌘⇧O` / `⌘⇧F8` | Toggle minimap / outline / problems |
| `F8` / `⇧F8` | Next / previous problem |
| `⌘J` | Toggle the console dock |

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
switching, template loading, duplicate-name handling and restore-from-storage —
plus the IDE layer: Emmet expansion (10 cases), symbol/breadcrumb extraction,
every linter, completion wiring, and the command palette, outline panel,
minimap, status bar and touch action tray against the rendered DOM. The
multi-project layer gets its own suite: create/switch/duplicate/star, template
projects, the v1→v2 migration, and search (flags, grouping, replace, jumping).

## Project layout

```
src/
  App.tsx                 state, persistence, console bridge, shortcuts
  components/
    TopBar.tsx            brand, mobile Code/Preview switch, actions
    EditorPane.tsx        tabs, editor, keypad and snippet tray
    CodeEditor.tsx        CodeMirror 6 view, keymap, imperative handle
    CommandPalette.tsx    ⌘⇧P command + file switcher
    OutlinePanel.tsx      symbols + problems tabs
    Minimap.tsx           document map with a draggable viewport
    Splitter.tsx          draggable editor/preview divider
    StatusBar.tsx         language, cursor, counts, problems, autosave
    PromptSheet.tsx       keyboard-safe prompt (go-to-line, rename)
    ProjectsSheet.tsx     project switcher: create, duplicate, star, export, delete
    SearchPanel.tsx       project-wide search & replace with quick queries
    PreviewPane.tsx       debounced live preview, widths, copy/reload
    BottomDock.tsx        tabbed Output/Problems dock
    ProjectRail.tsx       collapsible recent-projects rail
    SplitRatio.tsx        split-ratio slider that rides the divider
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
    diagnostics.ts        HTML/CSS/JSON/JS linters
    autocomplete.ts       tag/CSS/JS completions + snippet catalogs
    emmet.ts              abbreviation expander
    symbols.ts            outline symbols + breadcrumbs
    search.ts             project-wide search/replace + project insights
    editorExtensions.ts   Tab/Emmet keymap, placeholder, sizing, lint wiring
    storage.ts            workspace persistence (v2 multi-project + v1 migration)
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
