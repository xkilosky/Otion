import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
} from "@codemirror/commands";
import {
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  acceptCompletion,
} from "@codemirror/autocomplete";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
  ensureSyntaxTree,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap, openSearchPanel } from "@codemirror/search";
import { nextDiagnostic, previousDiagnostic, openLintPanel, forEachDiagnostic } from "@codemirror/lint";
import { RangeSetBuilder, EditorSelection } from "@codemirror/state";
import { languageForFile, lazyLanguageForFile } from "../lib/languages";
import { editorTheme, type SyntaxPreset } from "../lib/editorTheme";
import { completionsForFile } from "../lib/autocomplete";
import { smartIndentKeymap, emptyFilePlaceholder, editorSizing } from "../lib/editorExtensions";
import { collectSymbols, breadcrumbFor, type SymbolEntry } from "../lib/symbols";
import { expandAbbreviation } from "../lib/emmet";

export interface EditorStats {
  lines: number;
  words: number;
  chars: number;
  errors: number;
  warnings: number;
}

export interface EditorHandle {
  insert: (text: string) => void;
  moveHorizontal: (direction: -1 | 1) => void;
  indent: () => void;
  focus: () => void;
  remeasure: () => void;
  selectedText: () => string;
  expandEmmet: () => boolean;
  formatDocument: () => void;
  toggleComment: () => void;
  duplicateLine: () => void;
  selectNextOccurrence: () => void;
  moveLine: (direction: -1 | 1) => void;
  goToLine: (line: number) => void;
  goToSymbol: (symbol: SymbolEntry) => void;
  openSearch: () => void;
  openProblems: () => void;
  nextProblem: () => void;
  previousProblem: () => void;
  cutLine: () => string;
  stats: () => EditorStats;
}

interface CodeEditorProps {
  fileName: string;
  value: string;
  theme: "dark" | "light";
  syntax: SyntaxPreset;
  fontSize: number;
  wordWrap: boolean;
  visible: boolean;
  onChange: (value: string) => void;
  onFormat: () => void;
  onCursor?: (line: number, column: number) => void;
  onView?: (view: EditorView | null) => void;
  onContext?: (context: { symbols: SymbolEntry[]; breadcrumbs: string[]; line: number }) => void;
  onDiagnostics?: (counts: { errors: number; warnings: number }) => void;
  onStats?: (stats: EditorStats) => void;
  onSave?: () => void;
  onRun?: () => void;
  onToggleMinimap?: () => void;
  onToggleProblems?: () => void;
  onToggleOutline?: () => void;
}

/* ------------------------------- active line ------------------------------ */
const activeLineMark = Decoration.line({ class: "cm-otion-active-line" });

const activeLinePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const line = view.state.doc.lineAt(view.state.selection.main.head);
      if (line.number <= view.state.doc.lines) builder.add(line.from, line.from, activeLineMark);
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

/* ------------------------------- component -------------------------------- */

const CodeEditor = forwardRef<EditorHandle, CodeEditorProps>(function CodeEditor(props, ref) {
  const {
    fileName,
    value,
    theme,
    syntax,
    fontSize,
    wordWrap,
    visible,
    onChange,
    onFormat,
    onCursor,
    onView,
    onContext,
    onDiagnostics,
    onStats,
    onSave,
    onRun,
    onToggleMinimap,
    onToggleProblems,
    onToggleOutline,
  } = props;

  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const compartments = useRef({
    language: new Compartment(),
    theme: new Compartment(),
    wrap: new Compartment(),
    completion: new Compartment(),
    lint: new Compartment(),
    indent: new Compartment(),
  });

  const handlers = useRef({ onChange, onCursor, onContext, onDiagnostics, onStats, onSave, onRun });
  handlers.current = { onChange, onCursor, onContext, onDiagnostics, onStats, onSave, onRun };

  /* --------------------------- computed reactions -------------------------- */

  const emitContext = (instance: EditorView, immediate = false) => {
    const run = () => {
      if (!instance.dom.isConnected) return;
      const state = instance.state;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      handlers.current.onCursor?.(line.number, head - line.from + 1);
      handlers.current.onContext?.({
        symbols: collectSymbols(state, fileName),
        breadcrumbs: breadcrumbFor(state, head, fileName),
        line: line.number,
      });

      let errors = 0;
      let warnings = 0;
      forEachDiagnostic(state, (diagnostic) => {
        if (diagnostic.severity === "error") errors += 1;
        else if (diagnostic.severity === "warning") warnings += 1;
      });
      handlers.current.onDiagnostics?.({ errors, warnings });

      const doc = state.doc.toString();
      handlers.current.onStats?.({
        lines: state.doc.lines,
        words: doc.trim() ? doc.trim().split(/\s+/).length : 0,
        chars: doc.length,
        errors,
        warnings,
      });
    };
    // Give the parser a frame to finish before walking the tree.
    if (immediate) run();
    else window.setTimeout(run, 120);
  };

  /* ------------------------------ mount view ------------------------------- */

  useEffect(() => {
    if (!host.current) return;
    const c = compartments.current;

    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter({
        markerDOM: (open) => {
          const span = document.createElement("span");
          span.textContent = open ? "▾" : "▸";
          span.className = "otion-fold";
          return span;
        },
      }),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      indentUnit.of("  "),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      activeLinePlugin,
      editorSizing,
      emptyFilePlaceholder(fileName),
      EditorView.contentAttributes.of({
        autocapitalize: "off",
        autocorrect: "off",
        spellcheck: "false",
        "aria-label": "Code editor",
      }),
      c.language.of(languageForFile(fileName) ?? []),
      c.theme.of(editorTheme(theme, syntax)),
      c.wrap.of(wordWrap ? EditorView.lineWrapping : []),
      c.completion.of(completionsForFile(fileName)),
      c.indent.of(smartIndentKeymap(fileName)),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        { key: "Mod-Shift-f", preventDefault: true, run: () => (onFormat(), true) },
        { key: "Mod-Alt-l", preventDefault: true, run: () => (onFormat(), true) },
        { key: "Mod-Shift-m", preventDefault: true, run: () => (onToggleMinimap?.(), true) },
        { key: "Mod-Shift-o", preventDefault: true, run: () => (onToggleOutline?.(), true) },
        { key: "Mod-Shift-p", preventDefault: true, run: () => (onToggleProblems?.(), true) },
        { key: "Alt-ArrowUp", run: (v) => moveLines(v, -1) },
        { key: "Alt-ArrowDown", run: (v) => moveLines(v, 1) },
        { key: "Shift-Mod-k", run: (v) => deleteLine(v) },
        { key: "Shift-Mod-d", run: (v) => duplicateSelection(v) },
        { key: "Mod-d", run: (v) => selectNextOccurrence(v) },
        { key: "Mod-Enter", preventDefault: true, run: () => (handlers.current.onRun?.(), true) },
        { key: "Mod-s", preventDefault: true, run: () => (handlers.current.onSave?.(), true) },
        {
          key: "Tab",
          // Snippet/Emmet completions win over plain indentation, like VS Code.
          run: (v) => acceptCompletion(v),
        },
        { key: "Mod-Shift-\\", run: (v) => goToMatchingBracket(v) },
        { key: "Mod-Alt-ArrowDown", run: (v) => addCursorBelow(v) },
        { key: "Mod-Alt-ArrowUp", run: (v) => addCursorAbove(v) },
        { key: "F8", run: (v) => nextDiagnostic(v) },
        { key: "Shift-F8", run: (v) => previousDiagnostic(v) },
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
        if (update.selectionSet || update.docChanged) emitContext(update.view);
      }),
    ];

    const state = EditorState.create({ doc: value, extensions });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;
    onView?.(instance);

    let disposed = false;
    void lazyLanguageForFile(fileName).then((language) => {
      if (disposed || language === null) return;
      instance.dispatch({ effects: c.language.reconfigure(language) });
    });

    // Warm the parser so outline/breadcrumbs are populated immediately.
    window.setTimeout(() => {
      if (!disposed) ensureSyntaxTree(instance.state, instance.state.doc.length, 400);
    }, 150);
    emitContext(instance, true);

    return () => {
      disposed = true;
      onView?.(null);
      instance.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  /* ------------------------------ sync props ------------------------------- */

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const current = instance.state.doc.toString();
    if (current !== value) {
      instance.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.language.reconfigure(languageForFile(fileName) ?? []),
    });
  }, [fileName]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.theme.reconfigure(editorTheme(theme, syntax)),
    });
  }, [theme, syntax]);

  useEffect(() => {
    view.current?.dispatch({
      effects: compartments.current.wrap.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => view.current?.requestMeasure());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  /* ------------------------------ imperative ------------------------------- */

  useImperativeHandle(
    ref,
    (): EditorHandle => ({
      insert(text) {
        const instance = view.current;
        if (!instance) return;
        const { from, to } = instance.state.selection.main;
        if (text === "__LEFT__") {
          instance.dispatch({ selection: { anchor: Math.max(0, from - 1) } });
          instance.focus();
          return;
        }
        if (text === "__RIGHT__") {
          instance.dispatch({ selection: { anchor: to + 1 } });
          instance.focus();
          return;
        }
        if (text === "__TAB__") {
          instance.dispatch(instance.state.replaceSelection("  "));
          instance.focus();
          return;
        }
        instance.dispatch(instance.state.replaceSelection(text));
        const caret = instance.state.selection.main.head;
        const closing = text.search(/[)\]}>]/);
        if (closing > 0) {
          instance.dispatch({ selection: { anchor: caret - (text.length - closing) } });
        }
        instance.focus();
      },
      moveHorizontal(direction) {
        const instance = view.current;
        if (!instance) return;
        const head = instance.state.selection.main.head;
        const target =
          direction === -1 ? Math.max(0, head - 1) : Math.min(instance.state.doc.length, head + 1);
        instance.dispatch({ selection: { anchor: target } });
        instance.focus();
      },
      indent() {
        view.current?.dispatch(view.current.state.replaceSelection("  "));
        view.current?.focus();
      },
      focus() {
        view.current?.focus();
      },
      remeasure() {
        view.current?.requestMeasure();
      },
      selectedText() {
        const instance = view.current;
        if (!instance) return "";
        const { from, to } = instance.state.selection.main;
        return instance.state.sliceDoc(from, to);
      },
      expandEmmet() {
        const instance = view.current;
        if (!instance) return false;
        const viewState = instance.state;
        const head = viewState.selection.main.head;
        const line = viewState.doc.lineAt(head);
        const before = viewState.sliceDoc(line.from, head);
        const token = /[\w.#>+^*[\]{}=\-"']+$/.exec(before)?.[0];
        if (!token) return false;
        return expandAt(instance, head - token.length, head, token);
      },
      formatDocument() {
        onFormat();
      },
      toggleComment() {
        view.current && toggleLineComment(view.current);
      },
      duplicateLine() {
        view.current && duplicateLines(view.current);
      },
      selectNextOccurrence() {
        view.current && selectNextOccurrence(view.current);
      },
      moveLine(direction) {
        view.current && moveLines(view.current, direction);
      },
      goToLine(lineNumber) {
        const instance = view.current;
        if (!instance) return;
        const target = Math.min(Math.max(lineNumber, 1), instance.state.doc.lines);
        const line = instance.state.doc.line(target);
        instance.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: "center" }),
        });
        instance.focus();
      },
      goToSymbol(symbol) {
        const instance = view.current;
        if (!instance) return;
        const position = Math.min(symbol.from, instance.state.doc.length);
        instance.dispatch({
          selection: { anchor: position },
          effects: EditorView.scrollIntoView(position, { y: "center" }),
        });
        instance.focus();
      },
      openSearch() {
        view.current && openSearchPanel(view.current);
      },
      openProblems() {
        view.current && openLintPanel(view.current);
      },
      nextProblem() {
        view.current && nextDiagnostic(view.current);
      },
      previousProblem() {
        view.current && previousDiagnostic(view.current);
      },
      cutLine() {
        const instance = view.current;
        if (!instance) return "";
        const line = instance.state.doc.lineAt(instance.state.selection.main.head);
        const text = line.text;
        instance.dispatch({ changes: { from: line.from, to: Math.min(line.to + 1, instance.state.doc.length) } });
        return text;
      },
      stats() {
        const instance = view.current;
        if (!instance) return { lines: 0, words: 0, chars: 0, errors: 0, warnings: 0 };
        let errors = 0;
        let warnings = 0;
        forEachDiagnostic(instance.state, (diagnostic) => {
          if (diagnostic.severity === "error") errors += 1;
          else if (diagnostic.severity === "warning") warnings += 1;
        });
        const doc = instance.state.doc.toString();
        return {
          lines: instance.state.doc.lines,
          words: doc.trim() ? doc.trim().split(/\s+/).length : 0,
          chars: doc.length,
          errors,
          warnings,
        };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileName, onFormat],
  );

  // Linting depends on the file type; keep it in a compartment so switching
  // files doesn't rebuild the whole editor.
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    let cancelled = false;
    void import("../lib/editorExtensions").then(async ({ lintingFor }) => {
      if (cancelled) return;
      instance.dispatch({ effects: compartments.current.lint.reconfigure(lintingFor(fileName)) });
    });
    return () => {
      cancelled = true;
    };
  }, [fileName]);

  return <div className="otion-editor" ref={host} style={{ ["--editor-font-size" as string]: `${fontSize}px` }} />;
});

/* ----------------------------- line utilities ----------------------------- */

function lineRange(view: EditorView, direction: -1 | 1) {
  const { from, to } = view.state.selection.main;
  const start = view.state.doc.lineAt(from);
  const end = view.state.doc.lineAt(to);
  return { start, end, direction };
}

export function moveLines(view: EditorView, direction: -1 | 1) {
  const { start, end } = lineRange(view, direction);
  const doc = view.state.doc;
  const text = view.state.sliceDoc(start.from, end.to);
  if (direction === -1 && start.number === 1) return true;
  if (direction === 1 && end.number === doc.lines) return true;

  const target = direction === -1 ? doc.line(start.number - 1) : doc.line(end.number + 1);
  const changes =
    direction === -1
      ? [
          { from: target.from, to: target.to, insert: text },
          { from: start.from, to: end.to, insert: target.text },
        ]
      : [
          { from: start.from, to: end.to, insert: target.text },
          { from: target.from, to: target.to, insert: text },
        ];

  view.dispatch({
    changes,
    selection: {
      anchor: direction === -1 ? start.from - target.length - 1 : start.from + target.length + 1,
    },
  });
  return true;
}

function deleteLine(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const to = Math.min(line.to + 1, view.state.doc.length);
  view.dispatch({ changes: { from: line.from, to } });
  return true;
}

function duplicateLines(view: EditorView) {
  const { start, end } = lineRange(view, 1);
  const text = view.state.sliceDoc(start.from, end.to);
  view.dispatch({
    changes: { from: end.to, insert: `\n${text}` },
    selection: { anchor: end.to + text.length + 1 },
  });
  return true;
}

function duplicateSelection(view: EditorView) {
  const { from, to } = view.state.selection.main;
  if (from === to) return duplicateLines(view);
  const text = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from: to, insert: text },
    selection: { anchor: to + text.length },
  });
  return true;
}

function selectNextOccurrence(view: EditorView) {
  const { ranges } = view.state.selection;
  const last = ranges[ranges.length - 1];
  let word = last.empty
    ? (() => {
        const line = view.state.doc.lineAt(last.head);
        const rel = last.head - line.from;
        const match = /[\w$]+/g;
        for (const found of line.text.matchAll(match)) {
          if (rel >= (found.index ?? 0) && rel <= (found.index ?? 0) + found[0].length) {
            return { from: line.from + (found.index ?? 0), to: line.from + (found.index ?? 0) + found[0].length };
          }
        }
        return null;
      })()
    : { from: last.from, to: last.to };
  if (!word) return false;

  const text = view.state.sliceDoc(word.from, word.to);
  const existing = view.state.selection.ranges.map((range) => [range.from, range.to]);
  let searchFrom = Math.max(...ranges.map((range) => range.to));

  for (let attempts = 0; attempts < 200; attempts += 1) {
    const index = view.state.doc.toString().indexOf(text, searchFrom);
    if (index < 0) break;
    if (!existing.some(([from, to]) => index >= from && index + text.length <= to)) {
      view.dispatch({
        selection: EditorSelection.create(
          [...ranges, EditorSelection.range(index, index + text.length)],
          ranges.length,
        ),
      });
      return true;
    }
    searchFrom = index + 1;
  }
  return false;
}

const HTML_COMMENT_START = "<!--";
const CSS_LINE_COMMENT = "/*";
const CSS_LINE_COMMENT_END = "*/";

/** The extension shown in this editor's file tab — the editor DOM has no ext of its own. */
/** Select the bracket that matches the one at the caret (and vice-versa). */
function goToMatchingBracket(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const bracketAt = (at: number) => {
    const char = state.sliceDoc(at, at + 1);
    return "()[]{}".includes(char) ? char : "";
  };
  const opening = bracketAt(pos);
  const before = bracketAt(pos - 1);
  const start = opening ? pos : before ? pos - 1 : -1;
  if (start < 0) return false;

  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const reverse: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const char = state.sliceDoc(start, start + 1);
  const forward = Boolean(pairs[char]);
  const target = forward ? pairs[char] : reverse[char];
  let depth = 0;
  const limit = state.doc.length;

  for (let index = start; forward ? index < limit : index >= 0; index += forward ? 1 : -1) {
    const current = state.sliceDoc(index, index + 1);
    if (current === char) depth += 1;
    else if (current === target) {
      depth -= 1;
      if (depth === 0) {
        view.dispatch({ selection: { anchor: index, head: index + 1 }, scrollIntoView: true });
        return true;
      }
    }
  }
  return false;
}

/** Add a second cursor on the line below/above at the same column (VS Code ⌥⌘↓). */
function addCursorLine(view: EditorView, direction: 1 | -1): boolean {
  const { state } = view;
  const range = state.selection.main;
  const line = state.doc.lineAt(range.head);
  const target = direction > 0 ? line.number + 1 : line.number - 1;
  if (target < 1 || target > state.doc.lines) return false;
  const next = state.doc.line(target);
  const column = Math.min(range.head - line.from, next.length);
  const anchor = next.from + column;
  const ranges = [...state.selection.ranges, EditorSelection.cursor(anchor)];
  view.dispatch({ selection: EditorSelection.create(ranges), scrollIntoView: true });
  return true;
}

const addCursorBelow = (view: EditorView) => addCursorLine(view, 1);
const addCursorAbove = (view: EditorView) => addCursorLine(view, -1);

function fileExtensionOf(view: EditorView): string {
  const tab = view.dom.closest(".editor-pane")?.querySelector("[data-ext]");
  const name = tab?.getAttribute("data-name") ?? "";
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function toggleLineComment(view: EditorView) {
  const { state } = view;
  const ext = (view.dom.dataset.ext || fileExtensionOf(view)).toLowerCase();
  const first = state.doc.lineAt(state.selection.main.from).number;
  const lastLine = state.doc.lineAt(state.selection.main.to).number;
  const lines = [];
  for (let n = first; n <= lastLine; n += 1) lines.push(state.doc.line(n));

  const isMarkup = ["html", "htm", "svg", "xml"].includes(ext);
  const isCss = ["css", "scss"].includes(ext);
  const blockStart = isMarkup ? HTML_COMMENT_START : CSS_LINE_COMMENT;
  const blockEnd = isMarkup ? "-->" : CSS_LINE_COMMENT_END;

  // Decide once for the whole selection: are all lines already commented?
  const already = lines.every((line) => {
    const text = line.text.trim();
    if (!text) return true;
    return isMarkup ? text.startsWith("<!--") : isCss ? text.startsWith("/*") || text.endsWith("*/") : text.startsWith("//");
  });

  const changes = lines.map((line) => {
    const text = line.text;
    const indent = text.length - text.trimStart().length;
    if (!text.trim()) return null;
    if (already) {
      const trimmed = text.slice(indent);
      if (isMarkup) {
        return {
          from: line.from + indent,
          to: line.to,
          insert: trimmed.replace(/^<!--\s?/, "").replace(/\s?-->$/, ""),
        };
      }
      if (isCss) {
        return { from: line.from + indent, to: line.to, insert: trimmed.replace(/^\/\*\s?/, "").replace(/\s?\*\/$/, "") };
      }
      return { from: line.from + indent, to: line.to, insert: trimmed.replace(/^\/\/\s?/, "") };
    }
    const comment = isMarkup
      ? `${blockStart} ${text.slice(indent)} ${blockEnd}`
      : isCss
        ? `${blockStart} ${text.slice(indent)} ${blockEnd}`
        : `// ${text.slice(indent)}`;
    return { from: line.from + indent, to: line.to, insert: comment };
  });

  view.dispatch({ changes: changes.filter(Boolean) as { from: number; to: number; insert: string }[] });
  return true;
}

function expandAt(view: EditorView, from: number, to: number, token: string) {
  const expanded = expandAbbreviation(token);
  if (!expanded) return false;
  const caretOffset = expanded.indexOf("></");
  view.dispatch({
    changes: { from, to, insert: expanded },
    selection: { anchor: caretOffset > 0 ? from + caretOffset + 1 : from + expanded.length },
    scrollIntoView: true,
  });
  return true;
}

export default CodeEditor;
