import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import CodeEditor, { type EditorHandle, type EditorStats } from "./CodeEditor";
import OutlinePanel, { type OutlineDiagnostic } from "./OutlinePanel";
import Minimap from "./Minimap";
import { fileBadge, KEYPAD_LINES, KEYPAD_SYMBOLS, languageLabel } from "../lib/languages";
import type { SymbolEntry } from "../lib/symbols";
import { formatKind } from "../lib/format";
import type { ProjectFile } from "../types";

interface EditorPaneProps {
  files: ProjectFile[];
  activeFile: ProjectFile | null;
  theme: "dark" | "light";
  syntax: "neon" | "classic";
  fontSize: number;
  wordWrap: boolean;
  keypad: boolean;
  minimap: boolean;
  visible: boolean;
  onChange: (value: string) => void;
  onFormat: () => void;
  onSelectFile: (id: string) => void;
  onOpenFiles: () => void;
  onToggleKeypad: () => void;
  onRun: () => void;
  onCursor: (line: number, column: number) => void;
  onNotify: (message: string) => void;
  onStats: (stats: EditorStats) => void;
  onToggleMinimap: () => void;
  onSave: () => void;
  registerView: (view: EditorView | null) => void;
  /** Measured width of the selection, in characters, for the status bar. */
  onSelection: (length: number) => void;
  /** Live problem counts from the active file's linter. */
  onDiagnostics: (counts: { errors: number; warnings: number }) => void;
  /** Full problem list for the bottom dock. */
  onProblems: (problems: OutlineDiagnostic[]) => void;
  command: EditorCommand | null;
}

export type EditorCommand =
  | { kind: "problems"; nonce: number }
  | { kind: "search"; nonce: number }
  | { kind: "format"; nonce: number }
  | { kind: "goToLine"; nonce: number; line: number };

export default function EditorPane({
  files,
  activeFile,
  theme,
  syntax,
  fontSize,
  wordWrap,
  keypad,
  minimap,
  visible,
  onChange,
  onFormat,
  onSelectFile,
  onOpenFiles,
  onToggleKeypad,
  onRun,
  onCursor,
  onNotify,
  onStats,
  onToggleMinimap,
  onSave,
  registerView,
  onSelection,
  onDiagnostics,
  onProblems,
  command,
}: EditorPaneProps) {
  const editor = useRef<EditorHandle | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  const [symbols, setSymbols] = useState<SymbolEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [problems, setProblems] = useState<OutlineDiagnostic[]>([]);
  const [panel, setPanel] = useState<"none" | "outline">("none");
  const [currentLine, setCurrentLine] = useState(1);

  // External command bus (status bar, command palette, shortcuts).
  useEffect(() => {
    if (!command) return;
    const handle = editor.current;
    if (!handle) return;
    if (command.kind === "problems") {
      setPanel("outline");
      refreshProblems();
      handle.openProblems();
    } else if (command.kind === "search") {
      handle.openSearch();
    } else if (command.kind === "format") {
      handle.formatDocument();
    } else if (command.kind === "goToLine") {
      handle.goToLine(command.line);
    }
    // `nonce` makes repeat invocations of the same command fire again.
  }, [command]);

  // Selection width for the status bar; measured after each cursor move.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      onSelection(0);
      return;
    }
    const length = view.state.selection.ranges.reduce(
      (total, range) => total + (range.empty ? 0 : view.state.sliceDoc(range.from, range.to).length),
      0,
    );
    onSelection(length);
  }, [currentLine, activeFile?.id, onSelection]);

  // Returning from the Preview tab on a phone: re-measure before the next paint.
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => editor.current?.remeasure());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const press = (value: string) => {
    editor.current?.insert(value);
    setPressed(value);
    window.setTimeout(
      () => setPressed((current) => (current === value ? null : current)),
      130,
    );
  };

  const refreshProblems = () => {
    const view = viewRef.current;
    if (!view) return;
    const found: OutlineDiagnostic[] = [];
    // forEachDiagnostic is the supported way to read lint state.
    import("@codemirror/lint").then(({ forEachDiagnostic }) => {
      forEachDiagnostic(view.state, (diagnostic) => {
        const line = view.state.doc.lineAt(
          Math.min(diagnostic.from, view.state.doc.length),
        ).number;
        found.push({ ...diagnostic, line });
      });
      setProblems(found);
    });
  };

  useEffect(() => {
    if (panel === "outline") refreshProblems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, activeFile?.id]);

  // The dock always has the freshest lint list for the open file.
  useEffect(() => {
    onProblems(problems);
  }, [problems, onProblems]);

  return (
    <section className="pane editor-pane" aria-label="Code editor">
      <div className="tabbar">
        <button
          type="button"
          className="tabbar__icon"
          onClick={onOpenFiles}
          aria-label="Show file list"
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            <path
              d="M2.6 5.6h5l1.5 1.9h8.3v6.9a1.4 1.4 0 0 1-1.4 1.4H4a1.4 1.4 0 0 1-1.4-1.4V5.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="tabbar__scroll" role="tablist" aria-label="Open files">
          {files.map((file) => {
            const active = file.id === activeFile?.id;
            return (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`tab ${active ? "is-active" : ""}`}
                data-ext={(file.name.split(".").pop() ?? "").toLowerCase()}
                data-name={file.name}
                onClick={() => onSelectFile(file.id)}
              >
                <span className={`badge badge--${fileBadge(file.name).toLowerCase()}`}>
                  {fileBadge(file.name)}
                </span>
                <span className="tab__name">{file.name}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="tabbar__icon tabbar__icon--accent"
          onClick={() => {
            onRun();
            onNotify("Preview refreshed");
          }}
          aria-label="Run and refresh preview"
          title="Run (⌘↵)"
        >
          <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
            <path d="M6 4.2v11.6L16 10 6 4.2Z" fill="currentColor" />
          </svg>
        </button>
      </div>

      {breadcrumbs.length > 0 ? (
        <nav className="breadcrumbs" aria-label="Breadcrumbs">
          <button type="button" className="breadcrumbs__file" onClick={onOpenFiles}>
            {activeFile?.name ?? "—"}
          </button>
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb}-${index}`} className="breadcrumbs__crumb">
              <span aria-hidden="true">›</span>
              {crumb}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="editor-body">
        <div className="editor-wrap">
          {activeFile ? (
            <CodeEditor
              key={activeFile.id}
              ref={editor}
              fileName={activeFile.name}
              value={activeFile.content}
              theme={theme}
              syntax={syntax}
              fontSize={fontSize}
              wordWrap={wordWrap}
              visible={visible}
              onChange={onChange}
              onFormat={onFormat}
              onCursor={(line, column) => {
                setCurrentLine(line);
                onCursor(line, column);
              }}
              onView={(view) => {
                viewRef.current = view;
                registerView(view);
              }}
              onContext={({ symbols: found, breadcrumbs: trail }) => {
                setSymbols(found);
                setBreadcrumbs(trail);
              }}
              onDiagnostics={(counts) => {
                onDiagnostics?.(counts);
                if (panel === "outline") refreshProblems();
              }}
              onStats={onStats}
              onSave={onSave}
              onRun={onRun}
              onToggleMinimap={onToggleMinimap}
              onToggleOutline={() => setPanel((value) => (value === "outline" ? "none" : "outline"))}
              onToggleProblems={() => {
                setPanel("outline");
                window.setTimeout(refreshProblems, 60);
              }}
            />
          ) : (
            <div className="empty-state">
              <p>No file open.</p>
              <button type="button" className="btn btn--ghost" onClick={onOpenFiles}>
                Pick a file
              </button>
            </div>
          )}

          {panel === "outline" ? (
            <OutlinePanel
              symbols={symbols}
              diagnostics={problems}
              currentLine={currentLine}
              onSelectSymbol={(symbol) => {
                editor.current?.goToSymbol(symbol);
                setPanel("none");
              }}
              onSelectProblem={(diagnostic) => {
                const view = viewRef.current;
                if (!view) return;
                // Jump to the diagnostic and surface it in the lint panel.
                import("@codemirror/view").then(({ EditorView }) => {
                  view.dispatch({
                    selection: { anchor: Math.min(diagnostic.from, view.state.doc.length) },
                    effects: EditorView.scrollIntoView(
                      Math.min(diagnostic.from, view.state.doc.length),
                      { y: "center" },
                    ),
                  });
                  view.focus();
                  import("@codemirror/lint").then(({ openLintPanel }) => openLintPanel(view));
                });
              }}
              onClose={() => setPanel("none")}
            />
          ) : null}
        </div>

        {activeFile ? (
          <Minimap
            view={viewRef.current}
            value={activeFile.content}
            fileName={activeFile.name}
            visible={minimap && visible}
            onJump={(ratio) => {
              const view = viewRef.current;
              if (!view) return;
              view.scrollDOM.scrollTop = ratio * view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight / 2;
            }}
          />
        ) : null}
      </div>

      <div className="editor-foot">
        <div className="editor-foot__group">
          <button
            type="button"
            className={`chip ${panel === "outline" ? "is-on" : ""}`}
            onClick={() => setPanel((value) => (value === "outline" ? "none" : "outline"))}
            aria-pressed={panel === "outline"}
            title="Outline & problems (⌘⇧O)"
          >
            Outline
          </button>
          <button
            type="button"
            className={`chip ${showSnippets ? "is-on" : ""}`}
            onClick={() => setShowSnippets((value) => !value)}
            aria-expanded={showSnippets}
          >
            Snippets
          </button>
          <button
            type="button"
            className={`chip ${keypad ? "is-on" : ""}`}
            onClick={onToggleKeypad}
            aria-pressed={keypad}
          >
            Keys
          </button>
          <button
            type="button"
            className={`chip ${minimap ? "is-on" : ""}`}
            onClick={onToggleMinimap}
            aria-pressed={minimap}
            title="Toggle minimap (⌘⇧M)"
          >
            Map
          </button>
          <button
            type="button"
            className="chip chip--ghost chip--optional"
            onClick={() => {
              onFormat();
              onNotify(`Formatted (${formatKind(activeFile?.name ?? "")})`);
            }}
            title="Re-indent this file (⌘⇧F)"
          >
            Format
          </button>
          <button
            type="button"
            className="chip chip--ghost chip--optional"
            onClick={() => {
              editor.current?.toggleComment();
            }}
            title="Toggle line comment (⌘/)"
          >
            Comment
          </button>
          <button
            type="button"
            className={`chip chip--ghost ${moreOpen ? "is-on" : ""}`}
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
            title="More editor actions"
          >
            ⋯
          </button>
        </div>
        <span className="editor-foot__hint">{languageLabel(activeFile?.name ?? "")}</span>
      </div>

      {moreOpen ? (
        <div className="action-sheet" role="toolbar" aria-label="More editor actions">
          {[
            { label: "Search", hint: "⌘F", run: () => editor.current?.openSearch() },
            { label: "Go to line", hint: "⌘G", run: () => editor.current?.goToLine(currentLine) },
            { label: "Problems", hint: "F8", run: () => editor.current?.nextProblem() },
            { label: "Duplicate line", hint: "⇧⌘D", run: () => editor.current?.duplicateLine() },
            { label: "Delete line", hint: "⇧⌘K", run: () => editor.current?.cutLine() },
            { label: "Move line up", hint: "⌥↑", run: () => editor.current?.moveLine(-1) },
            { label: "Move line down", hint: "⌥↓", run: () => editor.current?.moveLine(1) },
            { label: "Select next match", hint: "⌘D", run: () => editor.current?.selectNextOccurrence() },
            { label: "Expand Emmet", hint: "Tab", run: () => editor.current?.expandEmmet() },
            { label: "Format", hint: "⇧⌥F", run: onFormat },
            { label: "Indent", hint: "⇥", run: () => editor.current?.indent() },
            { label: "Comment", hint: "⌘/", run: () => editor.current?.toggleComment() },
          ].map((action) => (
            <button
              key={action.label}
              type="button"
              className="action-sheet__item"
              onClick={() => {
                action.run();
                setMoreOpen(false);
              }}
            >
              <span>{action.label}</span>
              <kbd>{action.hint}</kbd>
            </button>
          ))}
        </div>
      ) : null}

      {showSnippets ? (
        <div className="keypad keypad--snippets" role="toolbar" aria-label="Code snippets">
          {KEYPAD_LINES.map((snippet) => (
            <button
              key={snippet.label}
              type="button"
              className={`key key--wide ${pressed === snippet.insert ? "is-pressed" : ""}`}
              title={snippet.hint}
              onClick={() => press(snippet.insert)}
            >
              {snippet.label}
            </button>
          ))}
        </div>
      ) : null}

      {keypad ? (
        <div className="keypad" role="toolbar" aria-label="Symbol keypad">
          {KEYPAD_SYMBOLS.map((symbol) => (
            <button
              key={symbol.label}
              type="button"
              className={`key ${pressed === symbol.insert ? "is-pressed" : ""}`}
              title={symbol.hint ?? symbol.label}
              onClick={() => press(symbol.insert)}
            >
              {symbol.label}
            </button>
          ))}
          <button
            type="button"
            className="key key--accent"
            onClick={() => editor.current?.indent()}
            aria-label="Insert indentation"
          >
            ⇥
          </button>
        </div>
      ) : null}
    </section>
  );
}
